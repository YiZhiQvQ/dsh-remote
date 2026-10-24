package app.dshremote.data

import android.webkit.CookieManager

object CookieBridge {
    fun writeSession(baseUrl: String, session: String) {
        val manager = CookieManager.getInstance()
        manager.setAcceptCookie(true)
        manager.setCookie(baseUrl, "dsh-remote-session=$session; Path=/")
        manager.flush()
    }

    fun clear(baseUrl: String) {
        val manager = CookieManager.getInstance()
        manager.setCookie(baseUrl, "dsh-remote-session=; Path=/; Max-Age=0")
        manager.flush()
    }
}
