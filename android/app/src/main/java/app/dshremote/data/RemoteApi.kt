package app.dshremote.data

import okhttp3.FormBody
import okhttp3.Request

enum class Probe { OK, UNAUTHORIZED, UNREACHABLE }

sealed interface LoginResult {
    data class Success(val session: String, val maxAgeSeconds: Long) : LoginResult
    data class BadCredentials(val message: String) : LoginResult
    data class RateLimited(val message: String) : LoginResult
    data class Failure(val message: String) : LoginResult
}

object RemoteApi {
    /**
     * A 401 is a healthy gate that wants a session; only a transport failure is
     * "unreachable". This is why pairing can verify a host before login.
     */
    fun probe(baseUrl: String, session: String?): Probe {
        val builder = Request.Builder()
            .url(baseUrl + "__dsh_remote/health")
            .header("User-Agent", Net.USER_AGENT)
            .get()
        if (session != null) builder.header("Cookie", "dsh-remote-session=$session")
        return try {
            Net.client.newCall(builder.build()).execute().use { response ->
                when (response.code) {
                    200 -> Probe.OK
                    401, 403 -> Probe.UNAUTHORIZED
                    else -> Probe.UNREACHABLE
                }
            }
        } catch (_: Exception) {
            Probe.UNREACHABLE
        }
    }

    fun login(baseUrl: String, username: String, password: String): LoginResult {
        val body = FormBody.Builder()
            .add("username", username)
            .add("password", password)
            .add("next", "/")
            .build()
        val request = Request.Builder()
            .url(baseUrl + "__dsh_remote/login")
            .header("User-Agent", Net.USER_AGENT)
            .post(body)
            .build()
        return try {
            Net.client.newCall(request).execute().use { response ->
                if (response.code == 429) {
                    return LoginResult.RateLimited("尝试次数过多，请稍后再试")
                }
                if (response.code in 300..399) {
                    val location = response.header("Location").orEmpty()
                    if (location.contains("error=1")) {
                        return LoginResult.BadCredentials("用户名或密码不正确")
                    }
                } else if (response.code != 200) {
                    return LoginResult.Failure("HTTP ${response.code}")
                }
                val cookie = response.headers("Set-Cookie")
                    .firstOrNull { it.startsWith("dsh-remote-session=") }
                    ?: return LoginResult.Failure("登录响应缺少会话 Cookie")
                val value = cookie.substringAfter('=').substringBefore(';')
                if (value.isEmpty()) return LoginResult.Failure("登录响应缺少会话 Cookie")
                val maxAge = Regex("Max-Age=(\\d+)").find(cookie)
                    ?.groupValues?.get(1)?.toLongOrNull() ?: 2_592_000L
                LoginResult.Success(value, maxAge)
            }
        } catch (exception: Exception) {
            LoginResult.Failure(exception.message ?: "网络错误")
        }
    }
}
