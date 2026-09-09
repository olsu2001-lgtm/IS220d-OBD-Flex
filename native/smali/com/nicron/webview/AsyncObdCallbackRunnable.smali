.class final Lcom/nicron/webview/AsyncObdCallbackRunnable;
.super Ljava/lang/Object;
.source "AsyncObdCallbackRunnable.java"

# interfaces
.implements Ljava/lang/Runnable;


# instance fields
.field private script:Ljava/lang/String;

.field private webView:Landroid/webkit/WebView;


# direct methods
.method public constructor <init>(Landroid/webkit/WebView;Ljava/lang/String;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/AsyncObdCallbackRunnable;->webView:Landroid/webkit/WebView;

    iput-object p2, p0, Lcom/nicron/webview/AsyncObdCallbackRunnable;->script:Ljava/lang/String;

    return-void
.end method


# virtual methods
.method public run()V
    .locals 3

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdCallbackRunnable;->webView:Landroid/webkit/WebView;

    iget-object v1, p0, Lcom/nicron/webview/AsyncObdCallbackRunnable;->script:Ljava/lang/String;

    const/4 v2, 0x0

    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V

    return-void
.end method
