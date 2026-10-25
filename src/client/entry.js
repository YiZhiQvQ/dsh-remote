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
import { installUrlCompat } from './url-compat.js'
import { createPlugin } from './app.js'

// Before anything else: DSH derives a resource's protocol with
// `new URL(address).hostname`. On ArkWeb that hostname comes back empty for the
// `dsh-resource://` scheme, so the document preview finds no provider and reports
// "the file resource service is unavailable" without issuing a request. The shim
// is a no-op on a kernel that parses correctly.
installUrlCompat(typeof window === 'undefined' ? undefined : window)

window.__ModuleLoader__.load({
  id: 'dsh-remote',
  factory(require) {
    return createPlugin(require('react'))
  },
})
