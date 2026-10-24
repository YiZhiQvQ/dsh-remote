package app.dshremote.ui

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import app.dshremote.App
import app.dshremote.R
import app.dshremote.data.Host
import app.dshremote.data.Probe
import app.dshremote.data.RemoteApi
import app.dshremote.databinding.ActivityHostsBinding
import app.dshremote.databinding.DialogNameBinding
import app.dshremote.databinding.DialogPairBinding
import app.dshremote.util.Extras
import app.dshremote.util.Insets
import app.dshremote.util.Urls
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HostsActivity : AppCompatActivity() {
    private lateinit var binding: ActivityHostsBinding
    private lateinit var adapter: HostAdapter
    private val app: App get() = application as App

    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        val contents = result.contents
        if (!contents.isNullOrBlank()) confirmPair(contents)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHostsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        Insets.apply(this, binding.root)

        adapter = HostAdapter(
            onClick = { openHost(it) },
            onLongClick = { hostMenu(it) },
        )
        binding.hostList.layoutManager = LinearLayoutManager(this)
        binding.hostList.adapter = adapter
        binding.scanButton.setOnClickListener { startScan() }
        binding.overflow.setOnClickListener { showOverflow() }
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        val hosts = app.hosts.all()
        adapter.submit(hosts)
        val empty = hosts.isEmpty()
        binding.empty.visibility = if (empty) View.VISIBLE else View.GONE
        binding.savedLabel.visibility = if (empty) View.GONE else View.VISIBLE
        binding.hostList.visibility = if (empty) View.GONE else View.VISIBLE
    }

    private fun startScan() {
        val options = ScanOptions()
            .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt(getString(R.string.scan_prompt))
            .setBeepEnabled(false)
            .setOrientationLocked(true)
        scanLauncher.launch(options)
    }

    private fun showOverflow() {
        val sheet = BottomSheetDialog(this)
        val view = layoutInflater.inflate(R.layout.sheet_hosts_menu, null)
        view.findViewById<View>(R.id.manualAdd).setOnClickListener {
            sheet.dismiss()
            manualAdd()
        }
        view.findViewById<View>(R.id.openSettings).setOnClickListener {
            sheet.dismiss()
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        sheet.setContentView(view)
        sheet.show()
    }

    private fun manualAdd() {
        val dialogBinding = DialogPairBinding.inflate(LayoutInflater.from(this))
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.add_host)
            .setView(dialogBinding.root)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.connect, null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val url = Urls.normalize(dialogBinding.url.text?.toString().orEmpty())
                if (url == null) {
                    dialogBinding.urlLayout.error = getString(R.string.invalid_url)
                    return@setOnClickListener
                }
                dialog.dismiss()
                confirmPair(url, dialogBinding.name.text?.toString().orEmpty())
            }
        }
        dialog.show()
    }

    /** Called with a scanned URL or a normalized manual URL. */
    private fun confirmPair(raw: String, presetName: String? = null) {
        val url = Urls.normalize(raw)
        if (url == null) {
            toast(R.string.invalid_url)
            return
        }
        val hostName = Urls.hostOf(url) ?: run {
            toast(R.string.invalid_url)
            return
        }
        val dialogBinding = DialogPairBinding.inflate(LayoutInflater.from(this))
        dialogBinding.url.setText(url)
        dialogBinding.url.isEnabled = false
        dialogBinding.name.setText(presetName?.takeIf { it.isNotBlank() } ?: hostName)
        dialogBinding.name.setSelection(dialogBinding.name.text?.length ?: 0)
        val isPrivate = Urls.isPrivateHost(hostName)
        dialogBinding.warning.visibility = if (isPrivate) View.GONE else View.VISIBLE
        dialogBinding.desc.text = getString(R.string.add_host_desc)
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.add_host)
            .setView(dialogBinding.root)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.save, null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val name = dialogBinding.name.text?.toString()?.trim().orEmpty().ifBlank { hostName }
                dialog.dismiss()
                addHost(name, url)
            }
        }
        dialog.show()
    }

    private fun addHost(name: String, url: String) {
        binding.scanButton.isEnabled = false
        lifecycleScope.launch {
            val probe = withContext(Dispatchers.IO) { RemoteApi.probe(url, null) }
            binding.scanButton.isEnabled = true
            if (probe == Probe.UNREACHABLE) {
                toast(R.string.pair_probe_failed)
                return@launch
            }
            val host = Host.create(name, url)
            app.hosts.add(host)
            app.prefs.currentHostId = host.id
            refresh()
            openHost(host)
        }
    }

    private fun openHost(host: Host) {
        app.prefs.currentHostId = host.id
        val session = app.secrets.get("session:${host.id}")
        val target = if (session == null) LoginActivity::class.java else WebActivity::class.java
        startActivity(Intent(this, target).putExtra(Extras.HOST_ID, host.id))
    }

    private fun hostMenu(host: Host) {
        val sheet = BottomSheetDialog(this)
        val view = layoutInflater.inflate(R.layout.sheet_host_menu, null)
        view.findViewById<android.widget.TextView>(R.id.sheetTitle).text = host.name
        view.findViewById<View>(R.id.rename).setOnClickListener {
            sheet.dismiss()
            renameHost(host)
        }
        view.findViewById<View>(R.id.delete).setOnClickListener {
            sheet.dismiss()
            confirmDelete(host)
        }
        sheet.setContentView(view)
        sheet.show()
    }

    private fun renameHost(host: Host) {
        val dialogBinding = DialogNameBinding.inflate(LayoutInflater.from(this))
        dialogBinding.name.setText(host.name)
        dialogBinding.name.setSelection(dialogBinding.name.text?.length ?: 0)
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.rename_title)
            .setView(dialogBinding.root)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.save, null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val name = dialogBinding.name.text?.toString()?.trim().orEmpty().ifBlank { host.name }
                app.hosts.update(host.copy(name = name))
                dialog.dismiss()
                refresh()
            }
        }
        dialog.show()
    }

    private fun confirmDelete(host: Host) {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.delete_title)
            .setMessage(getString(R.string.delete_message, host.name))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.delete_confirm) { _, _ -> deleteHost(host) }
            .show()
    }

    private fun deleteHost(host: Host) {
        app.hosts.remove(host.id)
        app.secrets.remove("session:${host.id}")
        app.secrets.remove("password:${host.id}")
        if (app.prefs.currentHostId == host.id) app.prefs.currentHostId = null
        refresh()
        toast(R.string.host_deleted)
    }

    private fun toast(message: Int) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
