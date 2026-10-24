package app.dshremote.util

import java.net.URI
import java.net.URLDecoder

object FileNames {
    fun from(contentDisposition: String?, url: String): String {
        val disposition = contentDisposition.orEmpty()
        val encoded = Regex("""filename\*=UTF-8''([^;]+)""", RegexOption.IGNORE_CASE)
            .find(disposition)?.groupValues?.get(1)
        if (!encoded.isNullOrBlank()) {
            return sanitize(runCatching { URLDecoder.decode(encoded, "UTF-8") }.getOrDefault(encoded))
        }
        val plain = Regex("""filename="?([^";]+)""", RegexOption.IGNORE_CASE)
            .find(disposition)?.groupValues?.get(1)
        if (!plain.isNullOrBlank()) return sanitize(plain.trimEnd('"'))
        val path = runCatching { queryParam(url, "path") }.getOrNull()
        val base = path?.substringAfterLast('/')?.substringAfterLast('\\')
        return sanitize(base ?: "download")
    }

    private fun queryParam(url: String, name: String): String? {
        val query = URI(url).rawQuery ?: return null
        for (part in query.split("&")) {
            val at = part.indexOf('=')
            if (at <= 0) continue
            if (part.substring(0, at) == name) {
                return URLDecoder.decode(part.substring(at + 1), "UTF-8")
            }
        }
        return null
    }

    private fun sanitize(name: String): String {
        val cleaned = name
            .replace(Regex("""[\\/:*?"<>|]"""), "_")
            .replace(Regex("""[\u0000-\u001f]"""), "_")
            .trim()
            .trim('.')
        return if (cleaned.isEmpty()) "download" else cleaned.take(180)
    }
}
