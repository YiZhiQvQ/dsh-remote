package app.dshremote.data

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object Net {
    lateinit var client: OkHttpClient
        private set

    const val USER_AGENT = "DshRemote/0.1.0 (Android)"

    fun init() {
        client = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .followRedirects(false)
            .build()
    }
}
