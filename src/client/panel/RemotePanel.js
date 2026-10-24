/**
 * The Remote Access panel: pairing URL, QR code, listener status, and the
 * soft pause/resume that replaces the plugin-manager master switch.
 *
 * @module dsh-remote/client/panel/RemotePanel
 */

/**
 * @param {{h: Function, React: any, t: (key: string) => string, isMobileLayout: () => boolean, icons: Record<string, Function>}} deps
 */
function createRemotePanel(deps) {
  const { h, React, t, isMobileLayout } = deps

  /** Copy text, preferring the async clipboard and falling back to a selectable field. */
  function fallbackCopy(document, text) {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    try {
      // execCommand is deprecated but remains the only synchronous fallback on
      // insecure origins, where navigator.clipboard is unavailable.
      document.execCommand('copy')
    } catch {
      // The caller leaves the URL visible in a text field.
    } finally {
      area.remove()
    }
  }

  /** @param {AbortSignal} signal */
  async function loadInfo(signal) {
    const response = await fetch('/api/remote/info', { credentials: 'same-origin', cache: 'no-store', signal })
    const data = await response.json()
    if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + String(response.status)))
    return data
  }

  return function RemotePanel(props) {
    const [state, setState] = React.useState({ loading: true, error: '', info: null })
    const [selectedAddress, setSelectedAddress] = React.useState('')
    const [copied, setCopied] = React.useState('')
    // Pause/resume is a round trip through the very listener it stops; the
    // button stays disabled and says "switching" for its duration.
    const [switching, setSwitching] = React.useState(false)
    const abortRef = React.useRef(null)

    const load = React.useCallback(async () => {
      if (abortRef.current !== null) abortRef.current.abort()
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      abortRef.current = controller
      try {
        const info = await loadInfo(controller === null ? undefined : controller.signal)
        setState({ loading: false, error: '', info })
      } catch (value) {
        if (value && value.name === 'AbortError') return
        setState((previous) => ({ ...previous, loading: false, error: String(value && value.message ? value.message : value) }))
      }
    }, [])

    React.useEffect(() => {
      void load()
      return () => {
        if (abortRef.current !== null) abortRef.current.abort()
      }
    }, [load])

    const copy = React.useCallback(async (value, address) => {
      if (!value) return
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(value)
        } else {
          fallbackCopy(document, value)
        }
        setCopied(address)
        window.setTimeout(() => setCopied(''), 1500)
      } catch {
        try {
          fallbackCopy(document, value)
          setCopied(address)
          window.setTimeout(() => setCopied(''), 1500)
        } catch {
          window.prompt(t('copy'), value)
        }
      }
    }, [])

    if (state.loading) return h('div', { className: 'dshr-panel' }, h('div', { className: 'dshr-loading' }, t('loading')))
    if (state.error) {
      return h('div', { className: 'dshr-panel' },
        h('div', { className: 'dshr-error' }, t('error') + ': ' + state.error),
        h('div', { className: 'dshr-row' }, h('button', { className: 'dshr-btn', type: 'button', onClick: load }, t('refresh')))
      )
    }

    const mobile = isMobileLayout()
    const info = state.info || {}
    const members = Array.isArray(info.lanAddresses) ? info.lanAddresses : []
    const warnings = Array.isArray(info.warnings) ? info.warnings : []
    const auth = info.auth && typeof info.auth === 'object' ? info.auth : {}
    const selected = selectedAddress || (members[0] && members[0].address) || ''
    const url = selected && members.some((row) => row.address === selected)
      ? 'http://' + selected + ':' + String(info.listenPort) + '/'
      : ''
    const sourceKey = auth.source === 'file' ? 'sourceFile' : auth.source === 'config' ? 'sourceConfig' : 'sourceDefault'
    const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
    const onProxyOrigin = currentPort === String(info.listenPort || '')
    // `paused` is the operator's intent; a listener that is merely starting up
    // or shutting down is not paused, and must not flip the button's label.
    const paused = info.paused === true
    const control = !onProxyOrigin
      ? h('button', {
          className: 'dshr-btn', type: 'button',
          // While the transition is in flight the button says what it is doing
          // and refuses a second press. Without this the label flipped only
          // after the round trip, so a click looked ignored and invited a
          // double click — which is what made pause/resume feel unreliable.
          disabled: switching,
          onClick: async () => {
            if (switching) return
            const action = paused ? 'resume' : 'pause'
            setSwitching(true)
            // Pausing tears the listener down, so a refresh issued right after the
            // call would race the teardown and spin. Flip the label from the answer
            // instead, then re-read once the transition has settled.
            try {
              const response = await fetch('/api/remote/control?action=' + action, { method: 'POST', credentials: 'same-origin' })
              const body = await response.json().catch(() => ({}))
              if (body && typeof body.paused === 'boolean') {
                setState((previous) => (previous.info === null
                  ? previous
                  : { ...previous, info: { ...previous.info, paused: body.paused } }))
              }
              window.setTimeout(() => { void load() }, action === 'pause' ? 600 : 200)
            } catch (value) {
              setState((previous) => ({ ...previous, error: String(value && value.message ? value.message : value) }))
            } finally {
              setSwitching(false)
            }
          },
        }, switching ? t('switching') : paused ? t('resume') : t('pause'))
      : null

    const header = h('div', { className: 'dshr-header' },
      h('div', null,
        h('h2', { className: 'dshr-title' }, mobile ? t('mobileMoreTitle') : t('title')),
        // The phone's "More" page is a list of destinations; a prose summary of
        // the same rows underneath the title is pure noise.
        mobile ? null : h('p', { className: 'dshr-desc' }, t('desc'))
      ),
      h('button', { className: 'dshr-btn', type: 'button', onClick: load }, t('refresh'))
    )

    // The destinations themselves, as bare rows: no card, no section heading.
    // The list is derived from one table, so adding a destination stays a
    // one-line change and the layout does not assume a fixed row count.
    const tools = mobile
      ? h('div', { className: 'dshr-tools' },
          [
            ['plugins', t('mobilePlugins')],
            ['schedules', t('mobileSchedules')],
            ['chatmanager', t('mobileTrash')],
          ].map(([id, label]) => h('button', {
            key: id,
            type: 'button',
            className: 'dshr-tool',
            onClick: () => {
              if (props && typeof props.openPanel === 'function') props.openPanel(id)
            },
          },
            h('span', { className: 'dshr-toolLabel' }, label),
            h('span', { className: 'dshr-toolChevron', 'aria-hidden': 'true' }, '\u203A')
          ))
        )
      : null

    // A listener that is mid-transition is not broken. Rendering it in the red
    // "no listener" state for the half second it takes to settle is what made a
    // pause look like a crash; show the phase instead.
    const phase = info.proxy && typeof info.proxy.phase === 'string' ? info.proxy.phase : ''
    const transitioning = phase === 'starting' || phase === 'stopping'
    const reachable = info.portProxyReachable === true
    const statusTone = transitioning ? 'dshr-wait' : reachable ? 'dshr-ok' : 'dshr-bad'
    const statusText = transitioning
      ? (phase === 'starting' ? t('starting') : t('stopping'))
      : (reachable ? t('proxyOk') : t('proxyDown'))
    const status = h('div', { className: 'dshr-status ' + statusTone },
      h('span', { className: 'dshr-dot' }),
      h('span', null, statusText + ' · ' + t('dshPort') + ' ' + String(info.dshPort || '?') + ' → ' + t('lanPort') + ' ' + String(info.listenPort || '?'))
    )

    const pairingCard = h('div', { className: 'dshr-card' },
      h('div', { className: 'dshr-row dshr-spread' },
        h('h3', { className: 'dshr-sectionTitle' }, t('pairing')),
        members.length > 1
          ? h('select', {
              className: 'dshr-btn',
              value: selected,
              onChange: (event) => setSelectedAddress(event.target.value),
            }, members.map((row) => h('option', { key: row.address, value: row.address }, row.address)))
          : null
      ),
      h('div', { className: 'dshr-url' }, url || t('pairingUnavailable')),
      selected
        ? h('img', { className: 'dshr-qr', src: '/api/remote/qr?address=' + encodeURIComponent(selected), alt: t('qrAlt') + ' ' + selected, loading: 'lazy' })
        : null,
      h('div', { className: 'dshr-row' },
        h('button', { className: 'dshr-btn dshr-primary', type: 'button', onClick: () => copy(url, selected), disabled: !url }, copied === selected ? t('copied') : t('copy')),
        url ? h('a', { className: 'dshr-btn', href: url, target: '_blank', rel: 'noreferrer' }, t('open')) : null
      ),
      members.length === 0 ? h('div', { className: 'dshr-note' }, t('noLan')) : null
    )

    const accountCard = h('div', { className: 'dshr-card' },
      h('h3', { className: 'dshr-sectionTitle' }, t('account')),
      h('div', { className: 'dshr-stack' },
        h('div', { className: 'dshr-row dshr-spread' },
          h('span', { className: 'dshr-label' }, t('username')),
          h('span', null, String(auth.username || 'admin'))
        ),
        h('div', { className: 'dshr-row dshr-spread' },
          h('span', { className: 'dshr-label' }, t('passwordSource')),
          h('span', { className: 'dshr-small' }, t(sourceKey))
        ),
        h('div', { className: 'dshr-row dshr-spread' },
          h('span', { className: 'dshr-label' }, t('dshPort')),
          h('span', { className: 'dshr-small' }, String(info.dshPort || '?'))
        ),
        h('div', { className: 'dshr-row dshr-spread' },
          h('span', { className: 'dshr-label' }, t('lanPort')),
          h('span', { className: 'dshr-small' }, String(info.listenPort || '?'))
        )
      ),
      onProxyOrigin
        ? h('button', {
            className: 'dshr-btn', type: 'button',
            onClick: () => {
              window.location.href = '/__dsh_remote/logout'
            },
          }, t('logout'))
        : h('div', { className: 'dshr-small' }, t('localNoLogout'))
    )

    return h('div', { className: 'dshr-panel' },
      header,
      tools,
      status,
      control ? h('div', { className: 'dshr-row' }, control) : null,
      paused ? h('div', { className: 'dshr-note' }, t('paused')) : null,
      h('div', { className: 'dshr-grid' }, pairingCard, accountCard),
      auth.source === 'default' ? h('div', { className: 'dshr-warning' }, t('defaultPassword')) : null,
      warnings.map((warning, index) => h('div', { className: 'dshr-warning', key: 'warning-' + String(index) }, warning)),
      h('div', { className: 'dshr-security' }, t('security'))
    )
  }
}

/**
 * The download button in the document preview header.
 * @param {{h: Function, React: any, t: (key: string) => string, icons: Record<string, Function>}} deps
 */
function createDownloadAction(deps) {
  const { h, React, t, icons } = deps
  return function DownloadAction(props) {
    const absolutePath = props && props.absolutePath
    if (!absolutePath) return null
    const onClick = React.useCallback(() => {
      const url = '/api/remote/download?path=' + encodeURIComponent(absolutePath)
      const link = document.createElement('a')
      link.href = url
      link.download = String(absolutePath).split(/[\\/]/).pop() || 'download'
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }, [absolutePath])
    return h('button', {
      type: 'button',
      className: 'dshr-download',
      onClick,
      title: t('download'),
      'aria-label': t('download'),
    }, h(icons.DownloadIcon, { size: 16 }))
  }
}

export { createRemotePanel, createDownloadAction }
