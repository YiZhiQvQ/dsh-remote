/**
 * The LAN sign-in page. Kept as markup plus a small string table so the
 * regression test can assert on structure instead of parsing a template.
 *
 * @module dsh-remote/host/auth/login-page
 */

const TITLE = 'DSH 远程访问'

const STYLE = [
  ':root{color-scheme:dark light;}',
  '*{box-sizing:border-box;}',
  'body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(120% 80% at 50% 0%,#1b2030 0%,#0e1015 55%,#0b0d11 100%);color:#e8eaed;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;-webkit-text-size-adjust:100%;}',
  '.card{width:min(380px,100%);padding:30px 24px 24px;border-radius:24px;background:rgba(25,28,34,.92);border:1px solid rgba(255,255,255,.06);box-shadow:0 24px 64px rgba(0,0,0,.45);backdrop-filter:blur(18px);}',
  '.brand{display:flex;align-items:center;gap:12px;margin-bottom:22px;}',
  '.mark{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:linear-gradient(145deg,#4f7cff,#3358d4);color:#fff;font-weight:700;font-size:15px;letter-spacing:.02em;box-shadow:0 8px 22px rgba(79,124,255,.35);flex:none;}',
  'h1{margin:0;font-size:21px;line-height:28px;font-weight:650;letter-spacing:.01em;}',
  '.sub{margin:4px 0 0;color:#9aa0a6;font-size:13px;line-height:19px;}',
  '.error{margin:0 0 16px;padding:11px 13px;border-radius:12px;background:rgba(255,90,90,.12);color:#ffb4ab;font-size:13px;line-height:19px;border:1px solid rgba(255,90,90,.18);}',
  'label{display:flex;flex-direction:column;gap:7px;margin-bottom:15px;color:#c7cbd1;font-size:13px;line-height:18px;}',
  'input{height:50px;padding:0 15px;border:1px solid #363b45;border-radius:14px;background:#0e1015;color:#e8eaed;font:inherit;font-size:16px;outline:none;transition:border-color .15s,box-shadow .15s;}',
  'input:focus{border-color:#6ea8fe;box-shadow:0 0 0 3px rgba(110,168,254,.18);}',
  'button{width:100%;height:50px;margin-top:6px;border:0;border-radius:14px;background:linear-gradient(180deg,#5b86ff,#446cf0);color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 10px 26px rgba(79,124,255,.28);-webkit-tap-highlight-color:transparent;}',
  'button:active{transform:translateY(1px);}',
  '.hint{margin:18px 0 0;color:#7d838b;font-size:11px;line-height:17px;}',
  '@media (prefers-color-scheme:light){body{background:radial-gradient(120% 80% at 50% 0%,#eef3ff 0%,#f7f8fb 55%,#ffffff 100%);color:#1b1f27;}.card{background:rgba(255,255,255,.94);border-color:rgba(0,0,0,.06);box-shadow:0 24px 64px rgba(20,30,60,.12);}.sub{color:#6b7280;}label{color:#4b5563;}input{background:#f7f8fb;border-color:#d9dee7;color:#1b1f27;}.hint{color:#8b929c;}}',
].join('')

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * @param {string} path
 * @param {{error?: boolean, message?: string, next?: string, username?: string}} [options]
 */
function loginPage(path, options = {}) {
  const error = options.error === true
  const message = options.message || '账号或密码错误'
  const next = options.next || '/'
  const username = options.username || 'admin'
  const lines = [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="theme-color" content="#0e1015">',
    '<title>' + TITLE + '</title>',
    '<style>' + STYLE + '</style>',
    '</head>',
    '<body>',
    '<main class="card">',
    '<div class="brand"><div class="mark">DSH</div><div><h1>远程访问</h1><p class="sub">用账号密码登录这台电脑上的 DeepSeek Harness</p></div></div>',
    error ? '<p class="error">' + escapeHtml(message) + '</p>' : '',
    '<form method="post" action="' + escapeHtml(path) + '">',
    '<input type="hidden" name="next" value="' + escapeHtml(next) + '">',
    '<label>账号<input name="username" value="' + escapeHtml(username) + '" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>',
    '<label>密码<input type="password" name="password" autocomplete="current-password" required></label>',
    '<button type="submit">登录</button>',
    '</form>',
    '<p class="hint">登录一次后 30 天内免登录。账号密码由 dsh-remote 插件管理。</p>',
    '</main>',
    '</body>',
    '</html>',
  ]
  return lines.filter((line) => line !== '').join('\n')
}

export { loginPage, escapeHtml, TITLE }
