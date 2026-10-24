# dsh-remote 优化记录（0.3.0 已实施）

> 基线：0.2.1（git 99d1929）。数字为本机实测（Windows 11 / Node v24.15.0）。
> 本文记录**做了什么、为什么、以及复核前后的事实**。第 1 节是实施前的证据，第 4 节是实施结果。

## 0. 结论

| 维度 | 0.2.1 | 0.3.0 | 验证方式 |
|---|---|---|---|
| 代理热路径（已登录） | 3.9–4.7 ms/req（约 250 req/s） | **0.06–0.10 ms/req**（>10,000 req/s） | `npm run bench` |
| 每请求 `os.networkInterfaces()` | 1 次（3.07 ms 同步） | 0 次 | `test/lan.test.mjs` + bench |
| 登录路径事件循环阻塞 | 30.39 ms（`scryptSync`） | 异步线程池 + 2 并发闸 | `host/auth/password.js` |
| 最大运行文件 | 1,422 行 | 366 行（`host/proxy/server.js`） | `test/contract.test.mjs` 断言 ≤400 |
| `client.js` gzip | 19,463 B | **17,546 B** | `npm run build` |
| CSS / i18n 位置 | 内联在 client.js（28.9 KB / 6.0 KB） | `src/client/styles/*.css` + `locale/*.json` | — |
| 哈希类名选择器 | 131 处散落在 CSS 里 | 集中在 `anchors.js` 一张表，全部标记 optional | 契约测试 |
| 测试用例 | 16（全 happy path） | **73** | `npm test` |
| 构建 | 手写单文件 | esbuild；`build:check` 防漂移 | CI |
| 静态检查 | 无 | ESLint + `tsc --checkJs` | CI |

## 1. 实施前的证据（保留，便于复核）

### 1.1 体量

| 文件 | 行 | 原始字节 | gzip |
|---|---|---|---|
| `index.js` | 281 | 10,782 | 3,484 |
| `client.js` | 1,422 | 85,862 | 19,463 |
| `scripts/lan-proxy-lib.mjs` | 779 | 28,693 | 7,716 |
| `scripts/download-lib.mjs` | 100 | 4,069 | 1,600 |
| `scripts/upload-lib.mjs` | 140 | 5,337 | 2,027 |
| `scripts/lan-address-lib.mjs` | 48 | 2,199 | 1,084 |
| **合计** | **2,770** | **136,942** | **35,374** |

### 1.2 三个热点的 A/B 实测（修复前）

```
agent:false                 0.505 ms/req   1,982 req/s
keep-alive Agent            0.053 ms/req  18,908 req/s   (-90%)
agent:false + 每请求网卡探测  3.489 ms/req     287 req/s
keep-alive + 快照            0.049 ms/req  20,299 req/s   (-99%)
```

- `allowedAuthorities` 传成函数，`lan-proxy-lib` 每个 `handleRequest` / `handleUpgrade` 都调用它
  → `os.networkInterfaces()`（实测 3.07 ms）。打开一次 GUI（约 100 个资源）≈ 300 ms 纯同步阻塞。
- 三处 `agent: false` → 每个静态资源重新三次握手。
- `verifyPassword` 用 `scryptSync`（实测 30.39 ms），位于未鉴权即可触发的路径。

### 1.3 契约事实（本次核对，包含对旧文档的更正）

1. **`shell.bottom` 只存在于真正在跑的运行时**。app.asar 里的 `dsh-client-ui-layout` 为
   0.2.1-rc.2，显式声明 `'shell.bottom': {kind:'single', scope:'root'}` 并渲染
   `data-shell-bottom`；而 `~/.dsh/profiles/node_modules/`deepseek-ai/*` 是 0.1.7-alpha.2 的
   旧副本，没有该插槽。**所以能力判据必须是运行时探测，不能读包版本。**
2. **旧 patch 里的 `connection.trustedHosts` 多余且理由写错**。代理把 Host/Origin 改写为
   loopback，上游围栏永远看不到 LAN 主机；而 `directory-picker-auto` 只看
   `ctx.webServer.host`（patch 钉死 127.0.0.1）→ win32 解析为 **native**。即注释所称
   「因此判定为远程、挂载应用内浏览」是错的，手机点「添加工作区」仍会在 PC 弹原生对话框。
   **这个判断是对的，但当时的处置是错的**：0.3.0 曾把 `auto` 禁用、改成全局 browse 后端，
   结果连本地桌面窗口的「添加工作区」也变成了网页版选择器——一个远程访问插件没有资格
   改动本地 UI。现已撤销，patch 不再触碰 directory-picker。0.3.x 的远程选择器改在客户端按来源接管：LAN 页面把 uiWorkspace.pickDirectory 换成应用内对话框，数据走 /api/remote/browse；本机 127.0.0.1 不替换。`test/config.test.mjs` 现在断言 patch 完全不提该插件。
3. **`engines.dsh` 无人校验**：`dsh` / `dsh-package-manifest` / `dsh-host-plugin-inventory`
   里 `engines` 命中 0 次 → 只是注释级约定。
4. **旧文档有两处论断不成立**：「限流顺序错误」——代码里判额其实已在验证之前；
   「`close()` 漏监听器」——`once('error')` 不会泄漏。真实问题是 `close()` 用 500 ms
   定时器兜底、可能早于 `server.close` 完成（并因此掩盖了一个真实竞态，见 §3）。

### 1.4 已修复的缺陷清单

| # | 位置 | 问题 | 0.3.0 处理 |
|---|---|---|---|
| B1 | proxy cookie 缓存 | 永久缓存、无过期、无单飞；DSH 重启后表现为「登录成功但页面 401」 | `{value, expiresAt}` + single-flight + 401 失效重取 |
| B2 | `forward` | 上游 `set-cookie`（含 `dsh-auth-*`）透传给浏览器 | 回写前剔除 |
| B3 | `safeNext` | 放行 `/\\evil.com`，浏览器归一为 `//evil.com` → 开放重定向 | URL 归一 + 单斜杠校验 + 向量测试 |
| B4 | `/__dsh_remote/health` | 在 Host 校验前返回 `hasToken` / `lastAuthError` | 移到围栏之后，只报存活 |
| B5 | 限流 | Map 无界、按 NAT 共享 | 有界 LRU + 定时清扫 + 可选 forwarded-for |
| B6 | `handleUpgrade` | 复制整套鉴权流水线并与 HTTP 侧分叉 | 共用 `authorize()` |
| B7 | `close()` / `start()` | 500 ms 兜底、复用 server 实例、pause/resume 竞态 | 每次新 server + 状态机 + 等 in-flight listen |
| B8 | `forward` | 未剔除 hop-by-hop 头 | `stripHopByHop` |
| B9 | download | 无 Range/ETag；stat→stream TOCTOU；中断不销毁流 | 206/416/304/If-Range + fd 流 + signal |
| B10 | upload | `.part` 落在用户目录；stat→rename 竞态 | `.dsh-remote-tmp/` + `open(...,'wx')` 占位 + 清扫 |
| B11 | `index.js` | `warnings` 在 apply 时算一次，永远过期 | 请求时计算 |
| B12 | `/info` | 同步 TCP 探测（500 ms×2）阻塞面板 | 返回上次结果 + 后台单飞刷新 |
| B13 | `/qr` | 每次请求重生成 SVG | 5 min / LRU 16 缓存 |
| B14 | download vs upload | 一个走 `ctx.fs`（受策略），一个直接 `node:fs` | 保留取舍，写进 `docs/DESIGN.md` |

### 1.5 结构与重复

- `scripts/` 混放运行时库与改密脚本 → 运行时移到 `host/`，`scripts/` 只留工具。
- `textResponse` ×3、`jsonResponse` ×2 → `host/http/respond.js`。
- `buildPublicUrl` / `buildTrustedHosts` 死导出 → 删除；`checkPortProxy` 移入 `host/net/port-probe.js`。
- `lan-proxy-lib` 内 **40 处**不属于本插件的代码 → 全部删除，契约测试兜底。

### 1.6 前端

- `immediately: true` 让 85 KB bundle 进首屏屏障 → **保留**（手机首帧必须已有移动样式），
  但体积压到 70,716 B / gzip 17,546 B，且 apply 期不再做网络探测。
- 250 ms × 40 次轮询 → 一个 childList observer + rAF，2 s 上限。
- 两个 `subtree:true` observer → 合并成一个 `chrome` 模块，值不变则不通知。
- `dragover` 每次 `elementFromPoint` + 逐级 `querySelectorAll` → rAF 合并 + 8 px 阈值。
- `openFilesTab` 12×60 ms 定时器 → 订阅式重试 + 1 s 上限，返回 Promise。
- `installRemoteToggleGuard` 只按 aria-label 文本 → 保留（插件管理器无稳定 id），加注释说明脆弱性。

## 2. 结构

```
index.js                 装配（213 行）
host/
  config.js lan.js log.js
  auth/{credentials,password,session,rate-limit,login-page,login-route}.js
  proxy/{server,forward,upstream,authorize}.js
  routes/{index,download,upload}.js
  http/respond.js  net/port-probe.js  media/qr.js
src/client/
  entry.js app.js log.js
  mobile/{anchors,gate,chrome,mode,service,nav,interactions}.js
  panel/{RemotePanel,icons}.js
  upload/{drop,toast}.js
  styles/{panel,mobile}.css
build.mjs  bench/proxy.mjs  types/*.d.ts
```

## 3. 实施中新发现的真实缺陷

**pause 与 start 的竞态**（B7 的实质）。测试「立即 pause 再 resume」暴露：
`close()` 在 `start()` 的 `listen()` 尚未落地时就返回 stopped，随后的 resume 撞上
`EADDRINUSE`。旧实现因为只在 dispose 时关闭，从未暴露。修法：`start()` 用 `starting`
promise 做单飞，`close()` 先 await 它再拆；插件侧再用一条 Promise 链串行化 pause/resume。

**upload 在 Windows 上必然失败**。先 `open(...,'wx')` 占位、再 rename，Windows 拒绝
替换仍打开的文件。修法：占位后立即 `close()` —— 独占创建本身已经是预留，不需要持有句柄。

## 4. 度量方法

```powershell
npm run bench        # 假上游，三行 A/B，p50 > 0.3 ms/req 则非零退出
npm test             # 73 用例
npm run build:check  # 产物与 src/client 一致
```

底层成本：

```powershell
node -e "const{networkInterfaces}=require('os');const t=process.hrtime.bigint();for(let i=0;i<300;i++)networkInterfaces();console.log(Number(process.hrtime.bigint()-t)/1e6/300,'ms/call')"
node -e "const c=require('crypto');const s=c.randomBytes(16);const t=process.hrtime.bigint();for(let i=0;i<10;i++)c.scryptSync('pw',s,64);console.log(Number(process.hrtime.bigint()-t)/1e6/10,'ms/call')"
```

## 5. 未做与后续

- **`!important` 未降到 150**：mobile.css 仍有 380 处。这层样式在与 DSH 自己的
  CSS-in-JS 竞争优先级，逐条降权需要真机逐个回归。已做的是把它们从 JS 字符串搬进
  可 lint、可 diff 的 `.css` 文件，并按 `anchors.js` 收敛选择器来源。后续应以
  「每条保留的 `!important` 配一行理由」为门槛逐步削减。
- **覆盖率未设门禁**：`node --test --experimental-test-coverage` 可用，但 70% 的目标
  需要先补齐 UI 层的 DOM 测试。
- **`require.async` 分包**：esbuild 的 `iife` 不支持代码分割，与 DSH 的 tsdown 约定
  不兼容，明确不做。`
