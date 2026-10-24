/**
 * The client plugin body: registers the Remote Access panel, the download
 * actions, and — on a real LAN browser — the mobile shell.
 *
 * @module dsh-remote/client/app
 */
import panelCss from './styles/panel.css'
import mobileCss from './styles/mobile.css'
import pickerCss from './styles/picker.css'
import accountCss from './styles/account.css'
import en from '../../locale/en.json'
import zh from '../../locale/zh.json'
import { isDesktopShell, isMobileLayout, isRemoteOrigin, forcedMobileMode, applyMobileViewport, installViewport } from './mobile/mode.js'
import { waitForShell, publish as publishCaps } from './mobile/gate.js'
import { installChrome, applyFrameClass } from './mobile/chrome.js'
import { createMobileNav } from './mobile/nav.js'
import { installMobileInteractions } from './mobile/interactions.js'
import { selectorFor } from './mobile/anchors.js'
import { layoutOf } from './mobile/service.js'
import { createIcons } from './panel/icons.js'
import { createRemotePanel, createDownloadAction } from './panel/RemotePanel.js'
import { installFilesDropUpload } from './upload/drop.js'
import { showUploadToast } from './upload/toast.js'
import { installRemoteDirectoryPicker } from './picker/install.js'
import { installAccountGuard } from './account/guard.js'
import { debug } from './log.js'

const NS = 'dsh-remote'
const PANEL_ID = 'dsh-remote'

/**
 * @param {any} React
 */
function createPlugin(React) {
  const h = React.createElement
  let translate = (key) => key
  /** @param {string} key */
  const t = (key) => {
    try {
      return translate(key)
    } catch {
      return key
    }
  }
  const icons = createIcons(h)

  return {
    inject: ['slots', 'locale', 'uiWorkspace'],
    apply(ctx) {
      translate = ctx.locale.bind(NS)

      // A real remote browser gets the mobile shell. The Electron desktop window
      // never does, even when it happens to load the LAN URL.
      const wantsMobile = () => !isDesktopShell() && (isRemoteOrigin() || forcedMobileMode() === true)

      ctx.effect(() => ctx.locale.register(NS, 'en', en.plugin), 'dsh-remote: en dictionary')
      ctx.effect(() => ctx.locale.register(NS, 'zh', zh.plugin), 'dsh-remote: zh dictionary')

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-dsh-remote', '')
        style.textContent = panelCss + '\n' + mobileCss + '\n' + pickerCss + '\n' + accountCss
        document.head.appendChild(style)
        return () => style.remove()
      }, 'dsh-remote: styles')

      // The host picker is the native OS dialog. On a LAN page, intercept that
      // one call and drive the in-app dialog instead; the local desktop window
      // keeps the native chooser.
      ctx.effect(() => installRemoteDirectoryPicker(ctx, { isRemoteOrigin, t }), 'dsh-remote: remote directory picker')

      // A remote page must not offer host-side "open with": the association
      // launches on the PC, not on the phone. Keep the download action instead.
      ctx.effect(() => {
        if (!isRemoteOrigin()) return () => {}
        const root = document.documentElement
        root.classList.add('dshr-remote')
        return () => root.classList.remove('dshr-remote')
      }, 'dsh-remote: remote marker')

      // The LAN page must not hand the host's local-path bridge to a remote
      // drag-and-drop: bytes are uploaded instead of a C:\\ path being inserted.
      ctx.effect(() => {
        if (!isRemoteOrigin()) return () => {}
        try {
          delete globalThis.__DSH_HOST_PATHS__
        } catch {
          // Fall through to the assignment below.
        }
        try {
          globalThis.__DSH_HOST_PATHS__ = undefined
        } catch {
          // A frozen global is harmless: only a real bridge object is truthy.
        }
        return () => {}
      }, 'dsh-remote: host path bridge')

      // The DeepSeek account is host-local: its sign-in needs a loopback OAuth
      // callback and its sign-out clears the grant for the desktop window too.
      // A LAN page must not offer either control; the desktop window keeps both.
      ctx.effect(() => {
        if (!isRemoteOrigin()) return () => {}
        return installAccountGuard({ document, window, t })
      }, 'dsh-remote: account guard')
      ctx.effect(() => installRemoteToggleGuard(document, t), 'dsh-remote: remote toggle guard')
      ctx.effect(() => installFilesDropUpload({ document, window, t }), 'dsh-remote: files drop upload')

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({
          openPanel: (id) => {
            const layout = layoutOf(ctx)
            if (id && layout && typeof layout.selectPanel === 'function') layout.selectPanel(id)
          },
        }),
      }, createRemotePanel({ h, React, t, isMobileLayout, icons })))

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL_ID, order: 21, locale: NS, label: () => t('panel'),
      }, icons.RemotePanelIcon))

      // The download action is a remote affordance only.
      //
      // On this machine the preview already has the file: the operator can open it,
      // reveal it, or copy its path. Injecting a button into the native header is
      // pure clutter, and this plugin is not allowed to change the local window's
      // UI. Only a page served through the LAN gate needs it.
      if (isRemoteOrigin()) {
        const downloadAction = createDownloadAction({ h, React, t, icons })
        ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({
          name: 'sidebar.right.tab.document.actions', id: 'dsh-remote-download', order: 100, locale: NS,
        }, downloadAction))
        ctx.slots.inject('sidebar.right.tab.document.unpreviewable', () => ctx.slots.register({
          name: 'sidebar.right.tab.document.unpreviewable', id: 'dsh-remote-download', order: 100, locale: NS,
        }, downloadAction))
      }

      installMobileLayer(ctx, wantsMobile)
    },
  }

  /**
   * Install the mobile shell only when the runtime actually provides the anchors
   * it needs. A missing required anchor means an incompatible DSH: keep the
   * desktop layout and say so once, rather than half-styling the page.
   *
   * @param {any} ctx
   * @param {() => boolean} wantsMobile
   */
  function installMobileLayer(ctx, wantsMobile) {
    if (!wantsMobile()) return
    let disposed = false
    ctx.effect(() => () => {
      disposed = true
    }, 'dsh-remote: mobile lifetime')

    void waitForShell(document, window).then((caps) => {
      if (disposed) return
      publishCaps(document.documentElement, caps)
      if (!caps.ok) {
        debug('mobile', 'mobile layer disabled; missing anchors: ' + caps.missing.join(', '))
        return
      }
      const root = document.documentElement
      const enable = () => {
        const mobile = isMobileLayout()
        if (typeof root.classList.toggle === 'function') root.classList.toggle('dshm-mobile', mobile)
        if (mobile) {
          applyMobileViewport(document)
          if (isRemoteOrigin()) root.classList.add('dshr-remote')
        }
      }
      enable()

      ctx.effect(() => {
        const onChange = () => enable()
        window.addEventListener('resize', onChange, { passive: true })
        window.addEventListener('orientationchange', onChange, { passive: true })
        let media
        if (typeof window.matchMedia === 'function') {
          try {
            media = window.matchMedia('(max-width: 900px)')
            if (media && typeof media.addEventListener === 'function') media.addEventListener('change', onChange)
            else if (media && typeof media.addListener === 'function') media.addListener(onChange)
          } catch {
            media = undefined
          }
        }
        return () => {
          window.removeEventListener('resize', onChange)
          window.removeEventListener('orientationchange', onChange)
          if (media) {
            if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onChange)
            else if (typeof media.removeListener === 'function') media.removeListener(onChange)
          }
        }
      }, 'dsh-remote: mobile viewport')

      ctx.effect(() => installViewport(document.documentElement, window), 'dsh-remote: keyboard')
      // Enable first, so `dshm-mobile` exists before the chrome sync runs.
      enable()
      ctx.effect(() => installChrome({
        document,
        window,
        panelId: PANEL_ID,
        readPanel: () => {
          const layout = layoutOf(ctx)
          const panelInfo = layout && layout.panelInfo
          if (!panelInfo || typeof panelInfo.getSnapshot !== 'function') return undefined
          try {
            return panelInfo.getSnapshot()
          } catch {
            return undefined
          }
        },
        onView: () => {},
      }), 'dsh-remote: chrome sync')
      // The React shell mounts after apply, so the frame element may not exist yet
      // when the first sync runs. One deferred pass tags it.
      window.setTimeout(() => {
        try {
          if (document.documentElement.classList.contains('dshm-mobile')) applyFrameClass(document)
        } catch {
          // No document in a test harness.
        }
      }, 0)
      ctx.effect(() => installMobileInteractions({ document, window, ctx }), 'dsh-remote: mobile interactions')

      ctx.slots.inject('shell.bottom', () => ctx.slots.register({
        name: 'shell.bottom',
        id: 'dsh-remote-mobile-nav',
        locale: NS,
      }, createMobileNav({ h, React, t, ctx, panelId: PANEL_ID, glyphs: icons, onView: () => {} })))
    })
  }
}

/**
 * The plugin-manager master switch restarts DSH and drops proxy pages. Block it
 * and point at the panel's pause/resume instead.
 *
 * @param {Document} document
 * @param {(key: string) => string} t
 * @returns {() => void}
 */
function installRemoteToggleGuard(document, t) {
  if (typeof document.addEventListener !== 'function') return () => {}
  const onClick = (event) => {
    const target = event && event.target
    if (!target || typeof target.closest !== 'function') return
    const toggle = target.closest('button[role="switch"]')
    if (toggle === null) return
    const label = String(toggle.getAttribute('aria-label') || '')
    if (!/远程访问|remote access/i.test(label)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const toast = showUploadToast(document, t('toggleUsePanel'))
    window.setTimeout(() => toast.remove(), 3200)
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}

export { createPlugin, NS, PANEL_ID, selectorFor }
