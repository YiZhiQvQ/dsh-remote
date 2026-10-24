package app.dshremote.data

import org.json.JSONObject
import java.util.UUID

data class Host(
    val id: String,
    var name: String,
    var url: String,
    var lastSeen: Long = 0L,
) {
    val baseUrl: String
        get() = if (url.endsWith("/")) url else "$url/"

    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("name", name)
        put("url", url)
        put("lastSeen", lastSeen)
    }

    companion object {
        fun create(name: String, url: String): Host =
            Host(UUID.randomUUID().toString(), name, url, System.currentTimeMillis())

        fun fromJson(json: JSONObject): Host = Host(
            id = json.optString("id"),
            name = json.optString("name", "DSH"),
            url = json.optString("url"),
            lastSeen = json.optLong("lastSeen", 0L),
        )
    }
}
