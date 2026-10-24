package app.dshremote

import android.app.Application
import app.dshremote.data.HostStore
import app.dshremote.data.Net
import app.dshremote.data.Prefs
import app.dshremote.data.SecretStore

class App : Application() {
    lateinit var hosts: HostStore
        private set
    lateinit var secrets: SecretStore
        private set
    lateinit var prefs: Prefs
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        hosts = HostStore(this)
        secrets = SecretStore(this)
        prefs = Prefs(this)
        Net.init()
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
