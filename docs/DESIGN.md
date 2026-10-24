# Design

## What the plugin is

One operator, one DSH process, no isolation. The person who signs in is the same
person sitting at the desktop. That single sentence explains most of the code:
there are no member accounts, no child hosts, and no workspace separation to
maintain.

## Why a reverse proxy at all

DSH binds its web server to `127.0.0.1` and authenticates browsers with a
process-lifetime launch token in the URL. Two things follow:

1. Binding `0.0.0.0` is not a supported posture — `dsh-host-webserver` is explicit
   that it carries "no TLS, authentication, or origin policy of its own".
2. Handing the launch token to a phone over plain LAN HTTP would put a
   full-privilege credential on the wire, where it also leaks into history and
   screenshots.

So the plugin runs its own listener on `0.0.0.0:3080`, keeps the token in process
memory, and exchanges it for DSH's host-bound cookie on behalf of the browser.

## Request path

```
browser ──cookie dsh-remote-session──▶ :3080
                                        │
                                        ├─ 1. Host fence
                                        │     private IP literal (regex) or LAN snapshot
                                        ├─ 2. Session HMAC (constant time)
                                        ├─ 3. Upstream cookie cache
                                        │     {value, expiresAt}, single-flight, 401 → invalidate
                                        ▼
                                  127.0.0.1:52551
                                     Host/Origin rewritten to the loopback authority
                                     Cookie = browser cookies − our auth + dsh-auth-*
```

**Why rewrite Host and Origin?** DSH's `connection` package fences every request on
`Host`/`Origin` and refuses anything that is not loopback or explicitly trusted.
Rewriting to `127.0.0.1:52551` means the fence keeps its full strength and the
plugin never has to widen it — which is why `cordis.patch.yml` no longer touches
`trustedHosts`.

**Why does the token exchange ask for the loopback URL?** `ctx.connection.authenticatedUrl`
returns a token only for the origin DSH believes it is serving. Asking for the LAN
URL can answer without one, and a proxy with no token forwards unauthenticated
requests — the browser then sees "authentication required" immediately after a
successful sign-in.

## Cookies

| Cookie | Held by | Lifetime | Notes |
|---|---|---|---|
| launch token | proxy process only | process lifetime | never logged, never sent to a browser |
| `dsh-auth-*` | proxy process only | from upstream `Max-Age`/`Expires`, default 10 min | stripped from upstream `set-cookie` before the response is written |
| `dsh-remote-session` | browser | 30 days (`sessionDays`) | `HttpOnly`, `SameSite=Lax`, HMAC-signed, bound to the credential version |

Changing the password changes the credential version, which revokes every session
without touching a store.

`Secure` is deliberately absent: the shipped transport is plain HTTP on a LAN. A
network you do not trust needs Tailscale or a TLS terminator — see the README.

## Host fence

Two arms, cheapest first:

1. **Private IP literal.** `isPrivateIpLiteral` accepts `10/8`, `172.16/12`,
   `192.168/16`, `100.64/10` and loopback by regex alone. A DNS-rebinding page
   cannot forge a URL hostname, and browsers send the URL hostname verbatim, so
   this arm rejects every rebound name without touching the OS.
2. **LAN snapshot.** `lanSnapshot()` refreshes a cached
   `os.networkInterfaces()` sample at most once per TTL (default 5 s). A phone
   that moves between Wi-Fi networks is re-admitted within one TTL.

Custom hostnames (mDNS, MagicDNS) that are not IP literals go in `allowedHosts`.

## Files

- **Download** goes through `ctx.fs.resolve`/`stat`, so the DSH sandbox policy
  decides what is readable, then streams from an open descriptor with
  `Range`/`ETag` support.
- **Upload** writes with `node:fs` directly. This is deliberate: a streamed
  upload of hundreds of megabytes does not fit the buffered `ctx.fs` write path,
  and the single-admin model already grants the operator the same reach the DSH
  process has. The trade-off is recorded here so it is a decision rather than an
  oversight; both routes share the same Windows path and reserved-name validation.

Uploads are written to `<target>/.dsh-remote-tmp/` on the same volume, then
renamed into place. The final name is claimed with `open(..., 'wx')` before the
bytes arrive, which is what makes two concurrent uploads of the same name produce
`file.txt` and `file (1).txt` instead of a coin flip. The placeholder handle is
closed immediately: Windows will not replace a file that is still open.

## Failure behavior

| Condition | Result |
|---|---|
| port taken | `state.phase = 'error'`, the panel reports it, the process keeps running |
| no private IPv4 | the panel warns; the listener still binds, only literals are admitted |
| DSH restarted | upstream 401 → cached cookie dropped → one retry → 503 with a sign-in hint |
| cookie expired | same path as above |
| auth file unreadable | falls back to config, then the built-in default, with one warning |
| no writable `$DSH_HOME` | the secret lives in memory, so sessions end at process exit |
| client disconnects mid-transfer | the upstream request and the read stream are destroyed with the signal |
