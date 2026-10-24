package app.dshremote.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import app.dshremote.App
import app.dshremote.R
import app.dshremote.data.Prefs
import app.dshremote.databinding.ActivitySettingsBinding
import app.dshremote.databinding.DialogNameBinding
import app.dshremote.util.Insets
import com.google.android.material.dialog.MaterialAlertDialogBuilder

class SettingsActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySettingsBinding
    private val app: App get() = application as App

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        Insets.apply(this, binding.root)

        binding.back.setOnClickListener { finish() }

        binding.keepScreenOn.isChecked = app.prefs.keepScreenOn
        binding.keepScreenOn.setOnCheckedChangeListener { _, checked ->
            app.prefs.keepScreenOn = checked
        }

        binding.rememberPassword.isChecked = app.prefs.rememberPassword
        binding.rememberPassword.setOnCheckedChangeListener { _, checked ->
            app.prefs.rememberPassword = checked
            if (!checked) {
                app.hosts.all().forEach { app.secrets.remove("password:${it.id}") }
            }
        }

        binding.downloadPath.setOnClickListener { editDownloadPath() }

        val version = runCatching {
            packageManager.getPackageInfo(packageName, 0).versionName
        }.getOrNull() ?: "0.1.0"
        binding.version.text = getString(R.string.app_name) + " " + version
        binding.server.text = getString(R.string.settings_server_value)
        updateDownloadPath()
    }

    override fun onResume() {
        super.onResume()
        updateDownloadPath()
    }

    private fun updateDownloadPath() {
        binding.downloadPathValue.text = "Download/" + app.prefs.downloadSubdir
    }

    private fun editDownloadPath() {
        val dialogBinding = DialogNameBinding.inflate(LayoutInflater.from(this))
        dialogBinding.name.setText(app.prefs.downloadSubdir)
        dialogBinding.name.setSelection(dialogBinding.name.text?.length ?: 0)
        dialogBinding.nameLayout.hint = getString(R.string.download_path_hint)
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.download_path_title)
            .setView(dialogBinding.root)
            .setNeutralButton(R.string.download_path_reset, null)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.save, null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val normalized = Prefs.normalizeDownloadSubdir(
                    dialogBinding.name.text?.toString().orEmpty(),
                )
                if (normalized == null) {
                    dialogBinding.nameLayout.error = getString(R.string.download_path_invalid)
                    return@setOnClickListener
                }
                app.prefs.downloadSubdir = normalized
                dialog.dismiss()
                updateDownloadPath()
                toast(R.string.download_path_saved)
            }
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener {
                app.prefs.downloadSubdir = Prefs.DEFAULT_DOWNLOAD_SUBDIR
                dialog.dismiss()
                updateDownloadPath()
                toast(R.string.download_path_saved)
            }
        }
        dialog.show()
    }

    private fun toast(message: Int) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
