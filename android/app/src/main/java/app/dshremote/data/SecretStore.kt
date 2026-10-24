package app.dshremote.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Small AES-GCM store backed by Android Keystore. Used for the session cookie
 * value and, when the operator opts in, the password.
 *
 * The WebView cookie is HttpOnly, so CookieManager.getCookie() cannot return it;
 * native features (downloads, uploads) keep their own encrypted copy instead.
 */
class SecretStore(context: Context) {
    private val prefs = context.getSharedPreferences("secrets", Context.MODE_PRIVATE)

    fun put(name: String, value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val payload = b64(cipher.iv) + ":" + b64(cipher.doFinal(value.toByteArray(Charsets.UTF_8)))
        prefs.edit().putString(name, payload).apply()
    }

    fun get(name: String): String? {
        val payload = prefs.getString(name, null) ?: return null
        return try {
            val parts = payload.split(":")
            if (parts.size != 2) return null
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, unb64(parts[0])))
            String(cipher.doFinal(unb64(parts[1])), Charsets.UTF_8)
        } catch (_: Exception) {
            null
        }
    }

    fun remove(name: String) {
        prefs.edit().remove(name).apply()
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build(),
        )
        return generator.generateKey()
    }

    private fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun unb64(text: String): ByteArray = Base64.decode(text, Base64.NO_WRAP)

    companion object {
        private const val ALIAS = "dsh-remote-secrets"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
