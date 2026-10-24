# Keep the JavaScript bridge methods if a bridge is added later.
-keepclassmembers class app.dshremote.ui.WebActivity$Bridge {
    public *;
}
