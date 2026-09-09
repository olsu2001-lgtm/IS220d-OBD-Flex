.class public Lcom/nicron/webview/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"


# instance fields
.field private bleObdBridge:Lcom/nicron/webview/BleObdBridge;

.field private filePathCallback:Landroid/webkit/ValueCallback;

.field private obdBridge:Lcom/nicron/webview/ObdBridge;

.field private powerGpsBridge:Lcom/nicron/webview/PowerGpsBridge;

.field private webView:Landroid/webkit/WebView;


# direct methods
.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method


# virtual methods
.method public onBackPressed()V
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :cond_0

    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z

    move-result v0

    if-eqz v0, :cond_0

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V

    goto :goto_0

    :cond_0
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V

    :goto_0
    return-void
.end method

.method public openFileChooser(Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 3

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    if-eqz v0, :store_callback

    const/4 v1, 0x0

    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    iput-object v1, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    :store_callback
    iput-object p1, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    :try_start_0
    invoke-virtual {p2}, Landroid/webkit/WebChromeClient$FileChooserParams;->createIntent()Landroid/content/Intent;

    move-result-object v0

    const-string v1, "android.intent.action.OPEN_DOCUMENT"

    invoke-virtual {v0, v1}, Landroid/content/Intent;->setAction(Ljava/lang/String;)Landroid/content/Intent;

    const-string v1, "android.intent.category.OPENABLE"

    invoke-virtual {v0, v1}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;

    const/16 v1, 0x4d3

    invoke-virtual {p0, v0, v1}, Lcom/nicron/webview/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end_0
    .catch Landroid/content/ActivityNotFoundException; {:try_start_0 .. :try_end_0} :catch_0

    const/4 v0, 0x1

    return v0

    :catch_0
    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    const/4 v1, 0x0

    iput-object v1, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    if-eqz v0, :chooser_unavailable

    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    :chooser_unavailable
    const/4 v0, 0x0

    return v0
.end method

.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 2

    const/16 v0, 0x4d3

    if-ne p1, v0, :super_result

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    if-eqz v0, :result_done

    invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;

    move-result-object v1

    const/4 p1, 0x0

    iput-object p1, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    :result_done
    return-void

    :super_result
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V

    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 4

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    const/4 p1, 0x1

    invoke-virtual {p0, p1}, Lcom/nicron/webview/MainActivity;->requestWindowFeature(I)Z

    new-instance v0, Landroid/webkit/WebView;

    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V

    iput-object v0, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;

    move-result-object v0

    invoke-virtual {v0, p1}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V

    invoke-virtual {v0, p1}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V

    invoke-virtual {v0, p1}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V

    invoke-virtual {v0, p1}, Landroid/webkit/WebSettings;->setAllowContentAccess(Z)V

    const/4 v1, 0x0

    invoke-virtual {v0, v1}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    invoke-virtual {v0, v1}, Landroid/webkit/WebSettings;->setMixedContentMode(I)V

    const/4 v2, -0x1

    invoke-virtual {v0, v2}, Landroid/webkit/WebSettings;->setCacheMode(I)V

    invoke-virtual {v0, p1}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    new-instance v2, Landroid/webkit/WebViewClient;

    invoke-direct {v2}, Landroid/webkit/WebViewClient;-><init>()V

    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    new-instance v2, Lcom/nicron/webview/FileChooserChromeClient;

    invoke-direct {v2, p0}, Lcom/nicron/webview/FileChooserChromeClient;-><init>(Lcom/nicron/webview/MainActivity;)V

    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    new-instance v0, Lcom/nicron/webview/ObdBridge;

    invoke-direct {v0, p0}, Lcom/nicron/webview/ObdBridge;-><init>(Landroid/app/Activity;)V

    iput-object v0, p0, Lcom/nicron/webview/MainActivity;->obdBridge:Lcom/nicron/webview/ObdBridge;

    iget-object v2, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    const-string v3, "obd"

    invoke-virtual {v2, v0, v3}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    new-instance v0, Lcom/nicron/webview/BleObdBridge;

    invoke-direct {v0, p0}, Lcom/nicron/webview/BleObdBridge;-><init>(Landroid/app/Activity;)V

    iput-object v0, p0, Lcom/nicron/webview/MainActivity;->bleObdBridge:Lcom/nicron/webview/BleObdBridge;

    iget-object v2, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    const-string v3, "bleObd"

    invoke-virtual {v2, v0, v3}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    new-instance v0, Lcom/nicron/webview/PowerGpsBridge;

    invoke-direct {v0, p0}, Lcom/nicron/webview/PowerGpsBridge;-><init>(Landroid/app/Activity;)V

    iput-object v0, p0, Lcom/nicron/webview/MainActivity;->powerGpsBridge:Lcom/nicron/webview/PowerGpsBridge;

    iget-object v2, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    const-string v3, "powerGps"

    invoke-virtual {v2, v0, v3}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    sget v0, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v2, 0x1f

    if-lt v0, v2, :legacy_ble_permission

    const/4 v2, 0x3

    new-array p1, v2, [Ljava/lang/String;

    const-string v0, "android.permission.BLUETOOTH_CONNECT"

    const/4 v2, 0x0

    aput-object v0, p1, v2

    const-string v0, "android.permission.BLUETOOTH_SCAN"

    const/4 v2, 0x1

    aput-object v0, p1, v2

    const-string v0, "android.permission.ACCESS_FINE_LOCATION"

    const/4 v2, 0x2

    aput-object v0, p1, v2

    const/16 v0, 0x4d2

    invoke-virtual {p0, p1, v0}, Lcom/nicron/webview/MainActivity;->requestPermissions([Ljava/lang/String;I)V

    goto :permission_done

    :legacy_ble_permission
    const/16 v2, 0x17

    if-lt v0, v2, :permission_done

    new-array p1, p1, [Ljava/lang/String;

    const-string v0, "android.permission.ACCESS_FINE_LOCATION"

    aput-object v0, p1, v1

    const/16 v0, 0x4d2

    invoke-virtual {p0, p1, v0}, Lcom/nicron/webview/MainActivity;->requestPermissions([Ljava/lang/String;I)V

    :permission_done
    iget-object p1, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    const-string v0, "file:///android_asset/index.html"

    invoke-virtual {p1, v0}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    iget-object p1, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {p0, p1}, Lcom/nicron/webview/MainActivity;->setContentView(Landroid/view/View;)V

    return-void
.end method

.method protected onDestroy()V
    .locals 2

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    if-eqz v0, :file_chooser_done

    const/4 v1, 0x0

    iput-object v1, p0, Lcom/nicron/webview/MainActivity;->filePathCallback:Landroid/webkit/ValueCallback;

    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    :file_chooser_done

    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->obdBridge:Lcom/nicron/webview/ObdBridge;

    if-eqz v0, :bridge_done

    invoke-virtual {v0}, Lcom/nicron/webview/ObdBridge;->disconnect()V

    :bridge_done
    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->bleObdBridge:Lcom/nicron/webview/BleObdBridge;

    if-eqz v0, :ble_bridge_done

    invoke-virtual {v0}, Lcom/nicron/webview/BleObdBridge;->disconnect()V

    :ble_bridge_done
    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->powerGpsBridge:Lcom/nicron/webview/PowerGpsBridge;

    if-eqz v0, :gps_bridge_done

    invoke-virtual {v0}, Lcom/nicron/webview/PowerGpsBridge;->stop()V

    :gps_bridge_done
    iget-object v0, p0, Lcom/nicron/webview/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :web_done

    invoke-virtual {v0}, Landroid/webkit/WebView;->destroy()V

    :web_done
    invoke-super {p0}, Landroid/app/Activity;->onDestroy()V

    return-void
.end method
