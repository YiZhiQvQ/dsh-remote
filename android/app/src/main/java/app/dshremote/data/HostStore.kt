package app.dshremote.data

import android.content.Context
import org.json.JSONArray

class HostStore(context: Context) {
    private val prefs = context.getSharedPreferences("hosts", Context.MODE_PRIVATE)

    fun all(): List<Host> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let { Host.fromJson(it) }
            }.filter { it.id.isNotEmpty() && it.url.isNotEmpty() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun get(id: String): Host? = all().firstOrNull { it.id == id }

    fun add(host: Host) {
        save(all() + host)
    }

    fun update(host: Host) {
        save(all().map { if (it.id == host.id) host else it })
    }

    fun remove(id: String) {
        save(all().filterNot { it.id == id })
    }

    private fun save(list: List<Host>) {
        val array = JSONArray()
        list.forEach { array.put(it.toJson()) }
        prefs.edit().putString(KEY, array.toString()).apply()
    }

    companion object {
        private const val KEY = "list"
    }
}
