/**
 * The handful of glyphs the panel and the bottom bar draw. Inline SVG keeps the
 * plugin free of an icon dependency and of any asset request.
 *
 * @module dsh-remote/client/panel/icons
 */

/**
 * @param {Function} h
 * @returns {Record<string, Function>}
 */
function createIcons(h) {
  const size = (props) => (props && props.size ? props.size : 16)

  function DownloadIcon(props) {
    return h('svg', { width: size(props), height: size(props), viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
      h('path', { d: 'M8 2v7m0 0 2.5-2.5M8 9 5.5 6.5M3 11.5V13h10v-1.5', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' })
    )
  }

  function PhoneIcon(props) {
    return h('svg', { width: size(props), height: size(props), viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
      h('rect', { x: 4, y: 1.5, width: 8, height: 13, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2 }),
      h('path', { d: 'M7 12.5h2', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' })
    )
  }

  function ChatGlyph() {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
      h('path', { d: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 13.5z' })
    )
  }

  function SessionsGlyph() {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
      h('path', { d: 'M8.5 6.5h11M8.5 12h11M8.5 17.5h11' }),
      h('circle', { cx: 4.5, cy: 6.5, r: 1.15, fill: 'currentColor', stroke: 'none' }),
      h('circle', { cx: 4.5, cy: 12, r: 1.15, fill: 'currentColor', stroke: 'none' }),
      h('circle', { cx: 4.5, cy: 17.5, r: 1.15, fill: 'currentColor', stroke: 'none' })
    )
  }

  function FilesGlyph() {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
      h('path', { d: 'M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l1.8 2h8A2 2 0 0 1 20.5 9.5v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z' })
    )
  }

  function MoreGlyph() {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none', 'aria-hidden': 'true' },
      h('circle', { cx: 6, cy: 12, r: 1.6 }),
      h('circle', { cx: 12, cy: 12, r: 1.6 }),
      h('circle', { cx: 18, cy: 12, r: 1.6 })
    )
  }

  return {
    DownloadIcon,
    PhoneIcon,
    ChatGlyph,
    SessionsGlyph,
    FilesGlyph,
    MoreGlyph,
    // The bottom bar looks its glyphs up by surface name. Keep these aliases in
    // step with the bar's item ids: a missing one renders `undefined` as an
    // element type, which React reports as error #130 and the slot drops.
    chat: ChatGlyph,
    sessions: SessionsGlyph,
    files: FilesGlyph,
    more: MoreGlyph,
    RemotePanelIcon(props) {
      return h('span', { className: 'dshr-panelGlyph' }, h(PhoneIcon, { size: props && props.size ? props.size : 16 }))
    },
  }
}

export { createIcons }
