package app.dshremote.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import app.dshremote.App
import app.dshremote.R
import app.dshremote.data.CookieBridge
import app.dshremote.data.Host
import app.dshremote.data.LoginResult
import app.dshremote.data.RemoteApi
import app.dshremote.databinding.ActivityLoginBinding
import app.dshremote.util.Extras
import app.dshremote.util.Insets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var host: Host
    private val app: App get() = application as App

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        Insets.apply(this, binding.root)

        val hostId = intent.getStringExtra(Extras.HOST_ID) ?: app.prefs.currentHostId
        val resolved = hostId?.let { app.hosts.get(it) }
        if (resolved == null) {
            finish()
            return
        }
        host = resolved

        binding.server.text = host.baseUrl
        binding.username.setText("admin")
        binding.remember.isChecked = app.prefs.rememberPassword
        app.secrets.get("password:${host.id}")?.let { saved ->
            binding.password.setText(saved)
            binding.remember.isChecked = true
        }
        binding.back.setOnClickListener { finish() }
        binding.signIn.setOnClickListener { signIn() }
    }

    private fun signIn() {
        val username = binding.username.text?.toString()?.trim().orEmpty()
        val password = binding.password.text?.toString().orEmpty()
        if (username.isEmpty() || password.isEmpty()) {
            showError(getString(R.string.login_failed))
            return
        }
        setBusy(true)
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                RemoteApi.login(host.baseUrl, username, password)
            }
            setBusy(false)
            when (result) {
                is LoginResult.Success -> {
                    app.secrets.put("session:${host.id}", result.session)
                    CookieBridge.writeSession(host.baseUrl, result.session)
                    app.prefs.rememberPassword = binding.remember.isChecked
                    if (binding.remember.isChecked) {
                        app.secrets.put("password:${host.id}", password)
                    } else {
                        app.secrets.remove("password:${host.id}")
                    }
                    app.hosts.update(host.copy(lastSeen = System.currentTimeMillis()))
                    startActivity(
                        Intent(this@LoginActivity, WebActivity::class.java)
                            .putExtra(Extras.HOST_ID, host.id),
                    )
                    finish()
                }
                is LoginResult.BadCredentials -> showError(result.message)
                is LoginResult.RateLimited -> showError(result.message)
                is LoginResult.Failure -> showError(result.message)
            }
        }
    }

    private fun setBusy(busy: Boolean) {
        binding.signIn.isEnabled = !busy
        binding.signIn.text = if (busy) "登录中…" else getString(R.string.sign_in)
        binding.error.visibility = if (busy) View.GONE else binding.error.visibility
    }

    private fun showError(message: String) {
        binding.error.text = message
        binding.error.visibility = View.VISIBLE
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
}
