package app.dshremote.util

import android.app.Activity
import android.content.res.Configuration
import android.os.Build
import android.view.View
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updatePadding

object Insets {
    /**
     * Android 15 enforces edge-to-edge for targetSdk 35+. Pad the root by the
     * system bars so the native chrome and the WebView stay out of the status and
     * navigation bars on every API level.
     */
    fun apply(activity: Activity, root: View) {
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        val controller = WindowCompat.getInsetsController(activity.window, root)
        val night = isNight(activity)
        controller.isAppearanceLightStatusBars = !night
        controller.isAppearanceLightNavigationBars = !night
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            view.updatePadding(top = bars.top, bottom = bars.bottom)
            insets
        }
    }

    /**
     * The DSH page uses the whole screen: the status bar is hidden, and a swipe
     * from the top edge reveals it transiently (it overlays the page instead of
     * reflowing it). The navigation bar stays, because the DSH bottom nav needs
     * its space above the gesture area.
     */
    fun applyImmersive(activity: Activity, root: View) {
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val attributes = activity.window.attributes
            attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            activity.window.attributes = attributes
        }
        val controller = WindowCompat.getInsetsController(activity.window, root)
        val night = isNight(activity)
        controller.isAppearanceLightStatusBars = !night
        controller.isAppearanceLightNavigationBars = !night
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            // The status bar is hidden, so the page starts at the very top. Only
            // the navigation bar keeps its height for the DSH bottom nav.
            val nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            view.updatePadding(top = 0, bottom = nav.bottom)
            insets
        }
        root.post { hideStatusBar(activity) }
    }

    /** Re-assert the hidden status bar after a dialog or a focus change. */
    fun hideStatusBar(activity: Activity) {
        val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.statusBars())
    }

    private fun isNight(activity: Activity): Boolean =
        (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
}
