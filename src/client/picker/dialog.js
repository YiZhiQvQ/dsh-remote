/**
 * The remote directory dialog. A plain DOM modal (the plugin already owns the
 * page) that drives the plugin's own /api/remote/browse route.
 *
 * It exists because the host's directory-picker-auto chooses the native OS
 * chooser, which a phone cannot answer. The client half swaps
 * uiWorkspace.pickDirectory only on a LAN page; the local desktop keeps the
 * native dialog.
 *
 * @module dsh-remote/client/picker/dialog
 */

const ROUTE = '/api/remote/browse'

/**
 * Create an element and return it typed by tag name, so callers can touch
 * `value`/`type`/`disabled` on form controls without casting at every use.
 *
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElementTagNameMap[K]}
 */
function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Open the directory dialog and resolve with the chosen absolute path, or
 * null when the operator dismisses it.
 *
 * @param {{t: (key: string) => string}} options
 * @returns {Promise<string|null>}
 */
function showDirectoryDialog(options) {
  const t = options.t
  return new Promise((resolve) => {
    let current = ''
    let busy = false
    let closed = false
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const overlay = element('div', 'dshr-picker-backdrop')
    const dialog = element('div', 'dshr-picker')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-label', t('pickerTitle'))

    const head = element('div', 'dshr-picker-head')
    head.appendChild(element('strong', 'dshr-picker-title', t('pickerTitle')))
    const close = element('button', 'dshr-picker-close', '×')
    close.type = 'button'
    close.setAttribute('aria-label', t('pickerCancel'))
    head.appendChild(close)

    const toolbar = element('div', 'dshr-picker-toolbar')
    const drive = element('select', 'dshr-picker-drive')
    drive.setAttribute('aria-label', t('pickerDrive'))
    const pathInput = element('input', 'dshr-picker-path')
    pathInput.type = 'text'
    pathInput.spellcheck = false
    pathInput.setAttribute('aria-label', t('pickerPath'))
    toolbar.append(drive, pathInput)

    const crumbs = element('div', 'dshr-picker-crumbs')
    const list = element('div', 'dshr-picker-list')
    const status = element('div', 'dshr-picker-status')

    const foot = element('div', 'dshr-picker-foot')
    const nameInput = element('input', 'dshr-picker-name')
    nameInput.type = 'text'
    nameInput.placeholder = t('pickerFolderName')
    nameInput.setAttribute('aria-label', t('pickerFolderName'))
    const create = element('button', 'dshr-picker-button', t('pickerCreate'))
    create.type = 'button'
    const spacer = element('span', 'dshr-picker-spacer')
    const cancel = element('button', 'dshr-picker-button', t('pickerCancel'))
    cancel.type = 'button'
    const select = element('button', 'dshr-picker-button dshr-picker-primary', t('pickerSelect'))
    select.type = 'button'

    foot.append(nameInput, create, spacer, cancel, select)
    dialog.append(head, toolbar, crumbs, list, status, foot)
    overlay.appendChild(dialog)
    document.body.appendChild(overlay)
    select.focus()

    function finish(value) {
      if (closed) return
      closed = true
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      overlay.remove()
      resolve(value)
    }

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish(null)
      }
    }

    document.addEventListener('keydown', onKey)
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) finish(null)
    })
    close.addEventListener('click', () => finish(null))
    cancel.addEventListener('click', () => finish(null))
    select.addEventListener('click', () => {
      if (!busy && current.length > 0) finish(current)
    })
    drive.addEventListener('change', () => {
      if (drive.value) void load(drive.value)
    })
    pathInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      const value = pathInput.value.trim()
      if (value.length > 0 && !busy) void load(value)
    })

    function setBusy(value) {
      busy = value
      select.disabled = value
      create.disabled = value
      nameInput.disabled = value
      drive.disabled = value
      pathInput.disabled = value
    }

    function setStatus(text, isError) {
      status.textContent = text || ''
      status.classList.toggle('dshr-picker-error', isError === true)
    }

    function render(data) {
      current = data.path
      const roots = Array.isArray(data.roots) ? data.roots : []
      drive.replaceChildren()
      for (const root of roots) {
        const option = document.createElement('option')
        option.value = root.path
        option.textContent = root.name
        drive.appendChild(option)
      }
      drive.style.display = roots.length > 0 ? '' : 'none'
      const lower = data.path.toLowerCase()
      const matched = roots.find((root) => lower.startsWith(root.path.toLowerCase()))
      if (matched) drive.value = matched.path
      if (document.activeElement !== pathInput) pathInput.value = data.path
      crumbs.replaceChildren()
      const items = Array.isArray(data.crumbs) ? data.crumbs : []
      items.forEach((crumb, index) => {
        const button = element('button', 'dshr-picker-crumb', crumb.name)
        button.type = 'button'
        button.title = crumb.path
        if (index === items.length - 1) button.classList.add('dshr-picker-crumb-current')
        button.addEventListener('click', () => { void load(crumb.path) })
        crumbs.appendChild(button)
        if (index < items.length - 1) crumbs.appendChild(element('span', 'dshr-picker-sep', '/'))
      })
      list.replaceChildren()
      if (items.length > 1) {
        const up = element('button', 'dshr-picker-row dshr-picker-up', '..')
        up.type = 'button'
        up.title = t('pickerUp')
        up.addEventListener('click', () => { void load(items[items.length - 2].path) })
        list.appendChild(up)
      }
      const entries = Array.isArray(data.entries) ? data.entries : []
      if (entries.length === 0) {
        list.appendChild(element('div', 'dshr-picker-empty', t('pickerEmpty')))
      }
      for (const entry of entries) {
        const row = element('button', 'dshr-picker-row', entry.name)
        row.type = 'button'
        row.title = entry.path
        if (entry.hidden) row.classList.add('dshr-picker-hidden')
        row.addEventListener('click', () => { void load(entry.path) })
        list.appendChild(row)
      }
      setStatus(data.truncated ? t('pickerTruncated') : '', false)
    }

    async function load(path) {
      if (closed) return
      setBusy(true)
      setStatus(t('pickerLoading'), false)
      try {
        const query = path ? '?path=' + encodeURIComponent(path) : ''
        const response = await fetch(ROUTE + query, { headers: { accept: 'application/json' } })
        const body = await response.json().catch(() => null)
        if (!response.ok || body === null || body.ok !== true) {
          throw new Error(body && body.error ? body.error : t('pickerError'))
        }
        render(body)
      } catch (error) {
        setStatus(messageOf(error), true)
      } finally {
        setBusy(false)
      }
    }

    async function createFolder() {
      const name = nameInput.value.trim()
      if (name.length === 0 || busy) return
      setBusy(true)
      setStatus(t('pickerLoading'), false)
      try {
        const response = await fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ path: current, name }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok || body === null || body.ok !== true) {
          throw new Error(body && body.error ? body.error : t('pickerCreateFailed'))
        }
        nameInput.value = ''
        await load(current)
      } catch (error) {
        setStatus(messageOf(error), true)
      } finally {
        setBusy(false)
      }
    }

    create.addEventListener('click', () => { void createFolder() })
    void load('')
  })
}

export { showDirectoryDialog }
