# Changelog

All notable changes to `dsh-remote`. The plugin follows the DSH desktop
runtime's minor line.

## Unreleased

### Fixed

- **鸿蒙平板上所有文件都无法预览（"文件资源服务不可用"）。** 根因是 ArkWeb 内核对
  非标准 scheme 的 URL 解析与 WHATWG 标准不一致。

  DSH 用 `new URL(address).hostname` 推导资源协议：

  ```js
  parsed = new URL(address)
  if (parsed.protocol !== 'dsh-resource:') return undefined
  return parsed.hostname === '' ? undefined : parsed.hostname.toLowerCase()
  ```

  在受影响的 ArkWeb 内核上，`new URL('dsh-resource://file/session/…')` 的
  `hostname` 返回空串，于是 `protocolOf` 得到 `undefined`。资源注册表拿
  `undefined` 去查 provider，永远查不到，直接把状态判为 `none`——**一个请求都
  不会发出**。这解释了全部现象：所有文件类型失败、文件列表正常（走另一条路）、
  网络日志里没有 `workspaceFiles/read`。

  新增 `src/client/url-compat.js`，在 DSH 模块加载前修补 `URL`：只修复
  "非特殊 scheme 且 hostname 为空"的情况，http/https/file/data 等特殊 scheme
  完全交给原生实现。内核解析正常时不做任何替换。

  修补后的对象是普通对象，**不挂在 `URL.prototype` 上**——那个原型的访问器
  需要 URL 内部槽位，继承它会让每次读取属性都抛 `Illegal invocation`。

### Added

- **Remote pages hide the host "open with" control.** The association launches on
  the PC, not on the phone; the preview header's download action is the remote
  equivalent. The control is marked by `data-open-target`.
- **Remote-only in-app workspace picker.** On a LAN page, "add workspace" opens
  the plugin's directory dialog (browse, new folder, select the current
  directory) backed by <code>/api/remote/browse</code>; the local desktop window
  keeps the native OS chooser. The client patches
  <code>uiWorkspace.pickDirectory</code> only when <code>isRemoteOrigin()</code>.

### Changed

- 空白/新会话页的侧栏开关移到右侧；普通对话页仍保持在左侧。
- Android app 的启动名称改为 **DeepSeek Harness**，图标换成 DSH 的小虎鲸
  （自适应图标，白底；前景从桌面端 <code>resources/icon.png</code> 提取）。

### Removed

- **面板里的「远程操作提示」卡片和「下载产物」说明。** 两者只是重复了界面上
  已经可见的行为；`publicUrl 仍是 loopback` 这条开发期自检警告也一并去掉，
  它属于 bundle patch 的调试信息，不该出现在用户面板里。
- **远程页面的 DeepSeek 账号登录 / 退出登录入口。** 登录需要 loopback 回调，
  局域网页面永远拿不到，点了只会报 protocol 错误；退出登录又会把电脑窗口的
  凭据一起清掉。现在远程页面把账号菜单里的「登录」「退出登录」、账号卡里的
  「登录」按钮和登录弹窗的主按钮都隐藏并拦截点击，提示改在电脑上操作。
  电脑本机窗口不受影响。

  隐藏用的是内联 `display:none!important`，不是只加 class：这些按钮由 React
  渲染，`className` 每次重渲染都会按 props 重新拼装，从外部加的 class 会被抹掉。
  观察器只监听 `childList`——同时监听属性会在自己写入标记属性时反复触发自己。
  两处都是实际踩到的坑，测试里各有一条回归用例钉住。
- **手机「更多」页的副标题和工具卡片外壳。** 「插件、自动化任务、回收站，以及
  手机远程访问」这行只是复述下面的三行入口；入口本身也不再套卡片和「工具」标题，
  直接以三行列表呈现，行数由数据表决定，不写死。

### Fixed

- **远程访问面板的端口状态行不再需要手动刷新。** `/api/remote/info` 为了不
  让面板打开时卡在 TCP 超时上，改成"先答缓存、后台刷新"。但缓存初始值是
  `false`，所以面板第一次打开永远显示"LAN 端口没有监听"，点一下刷新才正常。
  现在区分两种情况：缓存为空时等一次真实探测（本机连本机端口，开着立刻成功、
  关着立刻拒绝，实测 22ms），有缓存时才走后台刷新。并发请求共享同一次探测。 三个问题一起修了：
  1. 卸载时没有等待监听器关闭——`ctx.effect` 的清理函数返回了 `undefined`，
     而 Cordis 只会等待返回的 Promise。于是"停用→启用"偶尔撞上端口仍被占着，
     局域网端口直接死掉。现在返回 Promise，并分两种关闭模式：
     暂停立即断开所有连接，卸载则排空在途响应（下载不会被打断）。
  2. 排空模式原本要等满 5 秒：响应结束后连接变成空闲 keep-alive，
     没人再关它。现在每 50ms 清扫一次空闲连接，实测从 3 秒降到 143 毫秒。
  3. 面板在切换过程中显示红色"LAN 端口没有监听"，看起来像崩溃。
     现在区分 running / starting / stopping / stopped 四种状态，切换中显示
     "正在启动监听 / 正在停止监听"，圆点呼吸动画（尊重 prefers-reduced-motion）。
     暂停按钮在请求往返期间显示"正在切换…"并禁用，避免连点。
- **App 顶部多出一块空白。** 原生外壳已经按 system bar 留白，网页移动层又读了一次
  <code>env(safe-area-inset-top)</code>，造成双倍内边距。App 在页面加载后把
  <code>--dshm-safe-top/--dshm-safe-bottom</code> 置 0，由原生统一负责。
- **扫码页自动横屏、扫描线是红色。** ZXing 的 <code>CaptureActivity</code> 默认
  <code>sensorLandscape</code>，manifest 覆盖为 <code>portrait</code> 并锁定方向；
  <code>zxing_viewfinder_laser</code> 改为强调蓝。
- **Android 手机顶部顶到状态栏下面。** 移动层对所有平台都写
  `viewport-fit=cover`，但 Android Chrome 的 `env(safe-area-inset-top)` 是 0，
  于是页面第一行被状态栏盖住。现在只有 iOS 保留 cover，Android 交给浏览器留白；
  App 外壳另外按 system bar insets 加内边距，覆盖 Android 15 的强制边到边。

## 0.3.0

Restructured around the measured hot path. Behaviour is unchanged for the
operator except where a fix is listed.

### Performance

- **Cached LAN snapshot.** The Host fence called `os.networkInterfaces()` on
  every request (3.07 ms of synchronous time). It now reads a snapshot refreshed
  at most once per `lanSnapshotMs` (default 5 s), with a regex fast path for
  private IP literals. Measured on the deployed path: **3.94 → 0.09 ms/req**.
- **Keep-alive upstream pool.** Three call sites used `agent: false`, forcing a
  fresh TCP handshake per static asset. A shared `http.Agent` serves forwarding
  and token exchange; upgrades still own their socket. Measured: **0.44 → 0.055
  ms/req**.
- **Asynchronous password verification.** `scryptSync` blocked the event loop
  for ~30 ms on a route anyone on the LAN can reach; `scrypt` now runs on the
  libuv pool behind a two-slot semaphore.
- **QR results are cached** per address (5 min, LRU 16) instead of re-rendered on
  every panel mount.
- **`/api/remote/info` no longer waits on a TCP probe** once it has an answer; it
  serves the cached result and refreshes in the background. The first read after
  a listener starts does wait, because an empty cache used to report "no
  listener" until the operator pressed refresh.

### Fixed

- **Open redirect after sign-in.** `next=/\\evil.com` passed the old prefix check
  and browsers normalise the backslash into `//evil.com`. The redirect target is
  now resolved against a synthetic origin and must stay on it.
- **The DSH auth cookie reached the browser.** Upstream `set-cookie` for
  `dsh-auth-*` is now stripped before the response is written, so the LAN page
  holds only `dsh-remote-session` — as the README always claimed.
- **A restarted DSH stayed broken until the plugin restarted.** The cached
  `dsh-auth-*` cookie had no expiry and no invalidation. It now carries the
  lifetime parsed from `set-cookie`, shares one in-flight exchange, and is
  dropped on an upstream 401.
- **Unexpired uploads left garbage in the user's folder.** Temporary writes moved
  to a hidden sibling `.dsh-remote-tmp/` on the same volume, the final name is
  claimed with `open(..., 'wx')` (no stat-then-rename race), and stale files are
  swept after an hour.
- **Large media could not seek.** `/api/remote/download` implements single-range
  `Range` with `206`/`416`, `ETag`, `If-None-Match` and `If-Range`, and serves
  from an open descriptor instead of re-opening by path.
- **`/__dsh_remote/health` answered before the Host fence** and disclosed whether
  a launch token was present. It now requires the fence and reports only
  liveness.
- **Hop-by-hop headers were forwarded verbatim.** `connection`,
  `transfer-encoding`, `te`, `trailer`, `proxy-*` and `upgrade` are stripped from
  forwarded requests and responses.
- **`pause` could race `start`.** `close()` now waits for an in-flight listen and
  the plugin serialises pause/resume, so five rapid clicks settle in one
  consistent state.
- **Login throttling grew without bound** and shared one bucket per NAT address.
  The map is a bounded LRU with a periodic sweep and an opt-in
  `x-forwarded-for` key.
- **`cordis.patch.yml` widened the trust fence for no benefit.** The proxy
  rewrites Host and Origin to the loopback authority, so `connection.trustedHosts`
  never saw a LAN host; the block is gone.
- **The directory picker is no longer touched at all.** An earlier cut of this
  release disabled `dsh-host-directory-picker-auto` and composed the in-app browse
  backend, on the theory that the phone should not get an OS dialog it cannot
  answer. That was wrong: the composition is global, so the local desktop window's
  "add workspace" turned into the web picker too. A remote-access plugin must not
  change how the operator works at the desk. The row is gone; use a
  pre-registered workspace from the phone instead.

### Changed

- The 779-line proxy library is split into `host/` modules (auth, proxy,
  routes, http, net, media); no runtime file exceeds 350 lines.
- The hand-written 1,422-line `client.js` is now built from `src/client/` with
  esbuild. CSS, dictionaries and markup no longer live in one string blob.
- Mobile styling reads DSH's DOM through one anchor table and installs only when
  the required anchors are present; otherwise it keeps the desktop layout, logs
  one line, and marks `data-dshm-caps`.
- `!important` dropped from 389 to the ones the shell genuinely needs, and the
  131 hashed-class selectors now live in that table with a stated purpose.

### Added

- `npm run bench` measures the three hot-path regressions with a p50 budget.
- `npm run build:check` fails when `client.js` is stale.
- Contract tests pin the anchor table, the slot names, the dictionary parity and
  the package surface.
  73 tests (was 16), ESLint, `tsc --checkJs`, and a Node 22/24 CI matrix.

## 0.2.1

Mobile shell: bottom navigation, drawer, full-screen Files sheet, 15px body text,
dynamic LAN detection and a soft pause/resume switch.

## 0.2.0

Phone layout, mobile-first sign-in page, installable manifest.

## 0.1.0

First single-admin release: LAN reverse proxy, password gate, 30-day session,
pairing QR, downloads, streamed uploads, in-app directory browse.
