/**
 * Module-loader entry. This is the only file that knows about
 * `window.__ModuleLoader__`; everything else is a normal ES module and is
 * bundled into `client.js` by `build.mjs`.
 *
 * React arrives through the loader's `require`, which is why no module in this
 * tree imports it: the shell owns the single React instance.
 *
 * @module dsh-remote/client/entry
 */
import { createPlugin } from './app.js'

window.__ModuleLoader__.load({
  id: 'dsh-remote',
  factory(require) {
    return createPlugin(require('react'))
  },
})
