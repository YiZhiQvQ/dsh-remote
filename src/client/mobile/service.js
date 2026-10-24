/**
 * Thin, null-safe accessors for the DSH client services the mobile layer drives.
 * Every one of them may be absent on an older or newer runtime; a missing service
 * degrades one gesture instead of breaking the page.
 *
 * @module dsh-remote/client/mobile/service
 */

/** @param {any} ctx @param {string} name */
function service(ctx, name) {
  try {
    return ctx && typeof ctx.get === 'function' ? ctx.get(name) : undefined
  } catch {
    return undefined
  }
}

/** @param {any} ctx */
function layoutOf(ctx) {
  return service(ctx, 'layout')
}

/** @param {any} ctx */
function sidebarRightOf(ctx) {
  return service(ctx, 'sidebarRight')
}

/** @param {any} ctx @returns {string|null} */
function activePanelId(ctx) {
  const layout = layoutOf(ctx)
  const panelInfo = layout && layout.panelInfo
  if (!panelInfo || typeof panelInfo.getSnapshot !== 'function') return null
  try {
    const snapshot = panelInfo.getSnapshot()
    return snapshot === undefined || snapshot === null ? null : snapshot.activePanelId ?? null
  } catch {
    return null
  }
}

/** @param {any} ctx @param {string|null} id */
function selectPanel(ctx, id) {
  const layout = layoutOf(ctx)
  if (!layout || typeof layout.selectPanel !== 'function') return false
  try {
    layout.selectPanel(id)
    return true
  } catch {
    return false
  }
}

export { service, layoutOf, sidebarRightOf, activePanelId, selectPanel }
