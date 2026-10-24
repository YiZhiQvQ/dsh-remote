/**
 * Every DSH-internal DOM anchor the mobile layer relies on, in one table.
 *
 * Two classes of anchor live here and they age very differently:
 *
 * - **data attributes** (`data-sidebar-right-open`, `data-composer-input`, …) are
 *   stable enough to be treated as an interface. If one disappears the mobile
 *   layer degrades, and the reason is obvious.
 * - **hashed CSS-module class fragments** (`[class*="_sidebarCol"]`) are an
 *   implementation detail of DSH's build. Nothing guarantees them; a DSH upgrade
 *   may rename them without notice. They are all `optional`: when they are gone
 *   the drawer and the file-drop affordances stop, and the rest keeps working.
 *
 * Nothing else in the client may hard-code a DSH selector.
 *
 * @module dsh-remote/client/mobile/anchors
 */

/**
 * @typedef {object} Anchor
 * @property {string} id
 * @property {string} selector
 * @property {boolean} required - when a required anchor is missing the mobile layer is not
 *   installed at all. Only mark an anchor required when the shipped layout is
 *   guaranteed to render it on first paint.
 * @property {string} purpose
 */

/** @type {Anchor[]} */
const ANCHORS = [
  { id: 'shellRoot', selector: '[data-shell-bottom]', required: true, purpose: 'the frame row that hosts the bottom navigation' },
  { id: 'shellOverlay', selector: '[data-shell-overlay]', required: false, purpose: 'frame-wide floating layer' },
  // The right column is mounted lazily by sidebar-right: it exists once the user
  // opens Files, not on first paint. Neither selector can gate the layer.
  { id: 'rightPanelOpen', selector: '[data-sidebar-right-panel][data-sidebar-right-open]', required: false, purpose: 'whether the Files sheet is open' },
  { id: 'rightPanel', selector: '[data-sidebar-right-panel]', required: false, purpose: 'the Files sheet container' },
  { id: 'rightToggle', selector: '[data-sidebar-right-toggle]', required: false, purpose: 'the header button that opens Files' },
  { id: 'composerInput', selector: '[data-composer-input]', required: false, purpose: 'the composer, which must not steal focus under a sheet' },
  { id: 'sessionRow', selector: '[data-row-key]', required: false, purpose: 'a session or workspace row in the drawer' },
  { id: 'filesPath', selector: '[data-files-path]', required: false, purpose: 'a directory row that accepts a drop' },
  { id: 'conversationHeaderLeading', selector: '[data-conversation-header-leading]', required: false, purpose: 'the drawer toggle in the conversation header' },
  { id: 'dockTab', selector: '[data-dockkit-tab]', required: false, purpose: 'the Files tab strip' },
  { id: 'documentTab', selector: '[data-slot="sidebar.right.tab.document"]', required: false, purpose: 'whether a document preview owns the sheet' },
  // Hashed class fragments: present in the shipped runtime, not part of any contract.
  { id: 'sidebarCol', selector: '[class*="_sidebarCol"]', required: false, purpose: 'the left column, which becomes the drawer' },
  { id: 'centerCol', selector: '[class*="_centerCol"]', required: false, purpose: 'the conversation column' },
  { id: 'sectionHeader', selector: '[class*="_sectionHeader"]', required: false, purpose: 'workspace/session section headers' },
  { id: 'searchSlot', selector: '[class*="_searchSlot"]', required: false, purpose: 'the search field inside a section header' },
  { id: 'sessionRowInner', selector: '[class*="_sessionRow"]', required: false, purpose: 'session row padding' },
  { id: 'rowActions', selector: '[class*="_rowActions"]', required: false, purpose: 'row action cluster that must stay visible on touch' },
  { id: 'newSession', selector: 'button[class*="_newSession"]', required: false, purpose: 'the New Session button' },
  { id: 'panelRow', selector: 'button[class*="_panelRow"]', required: false, purpose: 'the sidebar panel rows' },
  { id: 'panelList', selector: '[class*="_panelList"]', required: false, purpose: 'the sidebar panel list, hidden on phones' },
  { id: 'regionArea', selector: '[class*="_regionArea"]', required: false, purpose: 'the sidebar scroll region' },
  { id: 'footArea', selector: '[class*="_footArea"]', required: false, purpose: 'the sidebar footer spacing' },
  { id: 'logoRow', selector: '[class*="_logoRow"]', required: false, purpose: 'the sidebar brand row height' },
  { id: 'brandName', selector: '[class*="_brandName"]', required: false, purpose: 'the sidebar brand text size' },
  { id: 'tooltip', selector: '[class*="_tooltip"]', required: false, purpose: 'tooltips that must not float over the drawer' },
  { id: 'headerActions', selector: '[class*="_headerActions"]', required: false, purpose: 'conversation header actions' },
  { id: 'titleCluster', selector: '[class*="_titleCluster"]', required: false, purpose: 'conversation header title cluster' },
]

/** @type {Map<string, Anchor>} */
const BY_ID = new Map(ANCHORS.map((anchor) => [anchor.id, anchor]))

/**
 * @param {string} id
 * @returns {string}
 */
function selectorFor(id) {
  const anchor = BY_ID.get(id)
  if (anchor === undefined) throw new Error('dsh-remote: unknown anchor "' + id + '"')
  return anchor.selector
}

/**
 * @param {string} id
 * @returns {Anchor}
 */
function anchorFor(id) {
  const anchor = BY_ID.get(id)
  if (anchor === undefined) throw new Error('dsh-remote: unknown anchor "' + id + '"')
  return anchor
}

export { ANCHORS, selectorFor, anchorFor }
