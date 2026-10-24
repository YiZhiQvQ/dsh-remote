package app.dshremote.data

import android.content.Context

class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var currentHostId: String?
        get() = prefs.getString("currentHostId", null)
        set(value) {
            prefs.edit().putString("currentHostId", value).apply()
        }

    var keepScreenOn: Boolean
        get() = prefs.getBoolean("keepScreenOn", true)
        set(value) {
            prefs.edit().putBoolean("keepScreenOn", value).apply()
        }

    var rememberPassword: Boolean
        get() = prefs.getBoolean("rememberPassword", false)
        set(value) {
            prefs.edit().putBoolean("rememberPassword", value).apply()
        }

    /** A subfolder under the public Download directory. */
    var downloadSubdir: String
        get() = prefs.getString("downloadSubdir", DEFAULT_DOWNLOAD_SUBDIR) ?: DEFAULT_DOWNLOAD_SUBDIR
        set(value) {
            prefs.edit().putString("downloadSubdir", normalizeDownloadSubdir(value) ?: DEFAULT_DOWNLOAD_SUBDIR).apply()
        }

    fun downloadRelativePath(name: String): String = downloadSubdir + "/" + name

    /**
     * Floating menu button position, in screen pixels from the top-left of the
     * WebView's window. -1 means "not placed yet" and the view uses its default.
     */
    var gearX: Int
        get() = prefs.getInt("gearX", -1)
        set(value) {
            prefs.edit().putInt("gearX", value).apply()
        }

    var gearY: Int
        get() = prefs.getInt("gearY", -1)
        set(value) {
            prefs.edit().putInt("gearY", value).apply()
        }

    companion object {
        const val DEFAULT_DOWNLOAD_SUBDIR = "DeepSeek Harness"

        /**
         * A relative folder under Download. Empty, absolute, and dot segments
         * are rejected so a typo cannot escape the public Downloads directory.
         */
        fun normalizeDownloadSubdir(value: String): String? {
            val text = value.trim()
            if (text.startsWith("/") || text.startsWith("\\")) return null
            val cleaned = text.replace('\\', '/').trim('/')
            if (cleaned.isEmpty()) return null
            val segments = cleaned.split('/')
            if (segments.any { it.isEmpty() || it == "." || it == ".." }) return null
            return cleaned
        }
    }
}
