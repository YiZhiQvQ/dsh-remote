package app.dshremote.ui

import android.Manifest
import android.app.DownloadManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import app.dshremote.App
import app.dshremote.R
import app.dshremote.data.CookieBridge
import app.dshremote.data.Host
import app.dshremote.data.Net
import app.dshremote.data.Probe
import app.dshremote.data.RemoteApi
import app.dshremote.databinding.ActivityWebBinding
import app.dshremote.util.Extras
import app.dshremote.util.FileNames
import app.dshremote.util.Insets
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

class WebActivity : AppCompatActivity() {
    private lateinit var binding: ActivityWebBinding
    private lateinit var host: Host
    private var baseHost: String = ""
    private var session: String? = null
    private var offline = false
    private var lastBack = 0L
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val app: App get() = application as App

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = fileCallback
        fileCallback = null
        if (callback == null) return@registerForActivityResult
        if (result.resultCode != RESULT_OK) {
            callback.onReceiveValue(null)
            return@registerForActivityResult
        }
        val data = result.data
        val uris: Array<Uri>? = when {
            data?.clipData != null -> Array(data.clipData!!.itemCount) { index ->
                data.clipData!!.getItemAt(index).uri
            }
            data?.data != null -> arrayOf(data.data!!)
            else -> null
        }
        callback.onReceiveValue(uris)
    }

    private val storagePermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread { if (offline) reload() }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityWebBinding.inflate(layoutInflater)
        setContentView(binding.root)
        Insets.apply(this, binding.root)

        val hostId = intent.getStringExtra(Extras.HOST_ID) ?: app.prefs.currentHostId
        val resolved = hostId?.let { app.hosts.get(it) }
        if (resolved == null) {
            finish()
            return
        }
        host = resolved
        baseHost = Uri.parse(host.baseUrl).host.orEmpty()
        session = app.secrets.get("session:${host.id}")
        if (session == null) {
            goLogin()
            return
        }

        if (app.prefs.keepScreenOn) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        setupWebView()
        binding.retry.setOnClickListener { reload() }
        binding.gear.setOnClickListener { showMenu() }
        setupGear()
        registerNetwork()
        setupBack()
        binding.webView.loadUrl(host.baseUrl)
        verifySession()
    }

    private fun setupWebView() {
        val webView = binding.webView
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.saveFormData = false
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        settings.mediaPlaybackRequiresUserGesture = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "http" || url.scheme == "https") {
                    if (url.host == baseHost) return false
                    openExternal(url)
                    return true
                }
                return false
            }

            override fun onPageCommitVisible(view: WebView, url: String) {
                super.onPageCommitVisible(view, url)
                applyNativeSafeArea()
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                setOffline(false)
                applyNativeSafeArea()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) setOffline(true)
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                AlertDialog.Builder(this@WebActivity)
                    .setTitle("证书错误")
                    .setMessage(error.toString())
                    .setPositiveButton(android.R.string.ok, null)
                    .show()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(
                        Intent.EXTRA_ALLOW_MULTIPLE,
                        fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE,
                    )
                    if (fileChooserParams.acceptTypes.isNotEmpty()) {
                        putExtra(Intent.EXTRA_MIME_TYPES, fileChooserParams.acceptTypes)
                    }
                }
                return try {
                    filePicker.launch(intent)
                    true
                } catch (_: Exception) {
                    fileCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                request.deny()
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            startDownload(url, userAgent, contentDisposition, mimeType)
        }
    }

    /**
     * The gear floats over the WebView. Drag it anywhere; the position is stored
     * per device (not per host) and clamped to the visible area on restore.
     */
    private fun setupGear() {
        val gear = binding.gear
        val density = resources.displayMetrics.density
        gear.post {
            val savedX = app.prefs.gearX
            val savedY = app.prefs.gearY
            if (savedX >= 0 && savedY >= 0) {
                moveGear(savedX.toFloat(), savedY.toFloat())
            }
        }
        var downX = 0f
        var downY = 0f
        var startX = 0f
        var startY = 0f
        var dragging = false
        gear.setOnTouchListener { view, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    startX = view.x
                    startY = view.y
                    dragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (!dragging && (dx * dx + dy * dy) > (8 * density) * (8 * density)) dragging = true
                    if (dragging) {
                        moveGear(startX + dx, startY + dy)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        app.prefs.gearX = view.x.roundToInt()
                        app.prefs.gearY = view.y.roundToInt()
                    } else {
                        view.performClick()
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    dragging = false
                    true
                }
                else -> false
            }
        }
    }

    private fun moveGear(x: Float, y: Float) {
        val gear = binding.gear
        val parent = binding.webRoot
        val padLeft = parent.paddingLeft
        val padTop = parent.paddingTop
        val maxX = (parent.width - parent.paddingRight - gear.width).coerceAtLeast(padLeft)
        val maxY = (parent.height - parent.paddingBottom - gear.height).coerceAtLeast(padTop)
        gear.x = x.coerceIn(padLeft.toFloat(), maxX.toFloat())
        gear.y = y.coerceIn(padTop.toFloat(), maxY.toFloat())
    }

    private fun startDownload(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            toast(R.string.download_unsupported)
            return
        }
        val name = FileNames.from(contentDisposition, url)
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(name)
            .setMimeType(mimeType)
            .addRequestHeader("Cookie", "dsh-remote-session=${session.orEmpty()}")
            .addRequestHeader("User-Agent", userAgent ?: Net.USER_AGENT)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                app.prefs.downloadRelativePath(name),
            )
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            storagePermission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
        getSystemService(DownloadManager::class.java).enqueue(request)
        toast(R.string.download_started)
    }

    /**
     * The native shell already pads the window by the system bars. The mobile
     * layer still reads env(safe-area-inset-top), which describes the display
     * cutout rather than the WebView's position, so it adds the status-bar
     * height a second time. Zero the two variables once the page has a document;
     * an inline style on <html> outranks the stylesheet's dshm-mobile rule.
     */
    private fun applyNativeSafeArea() {
        binding.webView.evaluateJavascript(
            "(function(){var r=document.documentElement;if(!r)return;" +
                "r.style.setProperty('--dshm-safe-top','0px');" +
                "r.style.setProperty('--dshm-safe-bottom','0px');})()",
            null,
        )
    }

    private fun setupBack() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                binding.webView.evaluateJavascript(BACK_SCRIPT) { value ->
                    if (value == "\"handled\"") return@evaluateJavascript
                    if (binding.webView.canGoBack()) {
                        binding.webView.goBack()
                        return@evaluateJavascript
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastBack < 2000L) {
                        finish()
                    } else {
                        lastBack = now
                        toast(R.string.press_again_to_exit)
                    }
                }
            }
        })
    }

    private fun verifySession() {
        val current = session ?: return
        lifecycleScope.launch {
            val probe = withContext(Dispatchers.IO) { RemoteApi.probe(host.baseUrl, current) }
            if (probe == Probe.UNAUTHORIZED && !isFinishing) {
                app.secrets.remove("session:${host.id}")
                goLogin()
            }
        }
    }

    private fun showMenu() {
        val sheet = BottomSheetDialog(this)
        val view = layoutInflater.inflate(R.layout.sheet_web_menu, null)
        view.findViewById<android.widget.TextView>(R.id.sheetTitle).text = host.name
        view.findViewById<View>(R.id.reload).setOnClickListener {
            sheet.dismiss()
            reload()
        }
        view.findViewById<View>(R.id.openInBrowser).setOnClickListener {
            sheet.dismiss()
            openExternal(Uri.parse(binding.webView.url ?: host.baseUrl))
        }
        view.findViewById<View>(R.id.openSettings).setOnClickListener {
            sheet.dismiss()
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        view.findViewById<View>(R.id.logout).setOnClickListener {
            sheet.dismiss()
            logout()
        }
        sheet.setContentView(view)
        sheet.show()
    }

    private fun logout() {
        app.secrets.remove("session:${host.id}")
        app.secrets.remove("password:${host.id}")
        CookieBridge.clear(host.baseUrl)
        goLogin()
    }

    private fun goLogin() {
        startActivity(Intent(this, LoginActivity::class.java).putExtra(Extras.HOST_ID, host.id))
        finish()
    }

    private fun reload() {
        setOffline(false)
        binding.webView.reload()
    }

    private fun setOffline(value: Boolean) {
        offline = value
        binding.offlineBar.visibility = if (value) View.VISIBLE else View.GONE
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            toast(R.string.no_browser)
        }
    }

    private fun registerNetwork() {
        try {
            getSystemService(ConnectivityManager::class.java)?.registerDefaultNetworkCallback(networkCallback)
        } catch (_: Exception) {
            // Older devices may refuse; the WebView still retries on reload.
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        try {
            getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(networkCallback)
        } catch (_: Exception) {
            // Not registered.
        }
        super.onDestroy()
    }

    private fun toast(message: Int) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    companion object {
        private val BACK_SCRIPT = """
            (function () {
              var root = document.documentElement;
              if (root && (root.classList.contains('dshm-sidebar-open') || root.classList.contains('dshm-right-open'))) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                return 'handled';
              }
              return 'idle';
            })()
        """.trimIndent()
    }
}
