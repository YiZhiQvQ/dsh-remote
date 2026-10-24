# Deployment and self-check

The plugin only works when the bundle patch actually applies. A missing step looks
like a broken plugin rather than a missing configuration, so run this list after
every install or DSH upgrade.

## Install

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" `
    plugin --profile desktop add <path to this repo>
```

## Check 1 — the bundle is mounted

`%USERPROFILE%\.dsh\profiles\desktop\package.json` must list `dsh-remote` in
**both** places:

```json
{
  "dependencies": { "dsh-remote": "link:<path to this repo>" },
  "dsh": { "profile": { "bundles": [
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    "dsh-remote"
  ] } }
}
```

A dependency without a bundle entry installs the package and applies **nothing**:
no port pin, no directory-picker override, no plugin row.

## Check 2 — the desktop listener is where the patch says

```powershell
Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 52551,3080
```

Two rows on `127.0.0.1:52551` and `0.0.0.0:3080`. A different port means the
`webserver` row was not applied; the plugin still proxies correctly (it reads
`ctx.webServer.port`), but the README's fixed URL and the pairing QR will not
match.

## Check 3 — the routes answer

```powershell
curl http://127.0.0.1:52551/api/remote/info
curl http://127.0.0.1:52551/api/remote/pairing
curl http://127.0.0.1:3080/__dsh_remote/health
```

`/api/remote/info` returns `lanAddresses`, `listenPort` and a `health` block. The
health route answers `401` without a session — that is the fence working, not a
failure.

## Check 4 — the phone reaches the gate

Open the pairing URL from the panel. You should see the sign-in card, not the
desktop UI. If you see a DSH error page instead, the proxy forwarded without a
`dsh-auth-*` cookie: look for `DSH token missing` in the DSH log.

## Check 5 — restart after code changes

| Changed | Action |
|---|---|
| `client.js`, `src/client/**` | rebuild, then refresh the page |
| `index.js`, `host/**`, `cordis.patch.yml` | fully quit DSH and relaunch |
| `package.json` bundle list | relaunch |

## Changing the password

```powershell
<path to this repo>\scripts\set-remote-password.ps1
```

Writes a scrypt salt/hash to `$DSH_HOME/dsh-remote-auth.json`. Restart DSH: the
file is read at boot, and the credential version it produces revokes existing
sessions.
