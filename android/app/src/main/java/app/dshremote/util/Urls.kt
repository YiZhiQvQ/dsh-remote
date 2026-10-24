package app.dshremote.util

import java.net.URI

object Urls {
    fun normalize(input: String): String? {
        var text = input.trim()
        if (text.isEmpty()) return null
        if (!text.contains("://")) {
            text = "http://$text"
        }
        return try {
            val uri = URI(text)
            val scheme = uri.scheme?.lowercase()
            if (scheme != "http" && scheme != "https") return null
            val host = uri.host
            if (host.isNullOrBlank()) return null
            val defaultPort = if (scheme == "https") 443 else 3080
            val port = if (uri.port == -1) defaultPort else uri.port
            if (port !in 1..65535) return null
            "$scheme://$host:$port/"
        } catch (_: Exception) {
            null
        }
    }

    fun hostOf(url: String): String? = try {
        URI(url).host
    } catch (_: Exception) {
        null
    }

    /** RFC1918, loopback, link-local, CGNAT (Tailscale) and mDNS names. */
    fun isPrivateHost(host: String): Boolean {
        val value = host.lowercase().trim('[', ']')
        if (value == "localhost" || value == "::1") return true
        if (value.endsWith(".local")) return true
        val parts = value.split(".")
        if (parts.size != 4) return false
        val octets = parts.map { it.toIntOrNull() ?: return false }
        if (octets.any { it !in 0..255 }) return false
        val first = octets[0]
        val second = octets[1]
        return when {
            first == 10 -> true
            first == 127 -> true
            first == 169 && second == 254 -> true
            first == 172 && second in 16..31 -> true
            first == 192 && second == 168 -> true
            first == 100 && second in 64..127 -> true
            else -> false
        }
    }
}
