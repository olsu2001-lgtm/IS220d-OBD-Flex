.class public final Lcom/nicron/webview/AsyncObdBridge;
.super Ljava/lang/Object;
.source "AsyncObdBridge.java"


# instance fields
.field private delegate:Lcom/nicron/webview/ObdBridge;

.field private webView:Landroid/webkit/WebView;


# direct methods
.method public constructor <init>(Lcom/nicron/webview/ObdBridge;Landroid/webkit/WebView;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/AsyncObdBridge;->delegate:Lcom/nicron/webview/ObdBridge;

    iput-object p2, p0, Lcom/nicron/webview/AsyncObdBridge;->webView:Landroid/webkit/WebView;

    return-void
.end method

.method private static error(Ljava/lang/Throwable;)Ljava/lang/String;
    .locals 2

    invoke-virtual {p0}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object v0

    if-nez v0, :message_ok

    invoke-virtual {p0}, Ljava/lang/Object;->getClass()Ljava/lang/Class;

    move-result-object p0

    invoke-virtual {p0}, Ljava/lang/Class;->getSimpleName()Ljava/lang/String;

    move-result-object v0

    :message_ok
    const-string v1, "__ERROR__"

    invoke-virtual {v1, v0}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method


# virtual methods
.method public connectAsync(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
    .locals 4
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    if-eqz p2, :invalid_id

    invoke-virtual {p2}, Ljava/lang/String;->length()I

    move-result v0

    if-lez v0, :invalid_id

    new-instance v0, Lcom/nicron/webview/AsyncObdConnectRunnable;

    invoke-direct {v0, p0, p1, p2}, Lcom/nicron/webview/AsyncObdConnectRunnable;-><init>(Lcom/nicron/webview/AsyncObdBridge;Ljava/lang/String;Ljava/lang/String;)V

    new-instance v1, Ljava/lang/Thread;

    const-string v2, "IS220d-OBD-connect"

    invoke-direct {v1, v0, v2}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;Ljava/lang/String;)V

    invoke-virtual {v1}, Ljava/lang/Thread;->start()V

    const-string v0, "OK"

    return-object v0

    :invalid_id
    new-instance v0, Ljava/lang/IllegalArgumentException;

    const-string v1, "Async request id puuttuu"

    invoke-direct {v0, v1}, Ljava/lang/IllegalArgumentException;-><init>(Ljava/lang/String;)V

    throw v0
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    :catch_0
    move-exception v0

    invoke-static {v0}, Lcom/nicron/webview/AsyncObdBridge;->error(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method

.method public deliverResult(Ljava/lang/String;Ljava/lang/String;)V
    .locals 6

    :try_start_0
    if-nez p2, :result_ok

    const-string p2, "__ERROR__Tyhjä async-vastaus"

    :result_ok
    const-string v0, "UTF-8"

    invoke-virtual {p2, v0}, Ljava/lang/String;->getBytes(Ljava/lang/String;)[B

    move-result-object v0

    const/4 v1, 0x2

    invoke-static {v0, v1}, Landroid/util/Base64;->encodeToString([BI)Ljava/lang/String;

    move-result-object v0

    new-instance v1, Ljava/lang/StringBuilder;

    invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V

    const-string v2, "globalThis.__IS220D_OBD_ASYNC_RESULT__&&globalThis.__IS220D_OBD_ASYNC_RESULT__('"

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v1, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    const-string v2, "','"

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v1, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    const-string v0, "')"

    invoke-virtual {v1, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    iget-object v1, p0, Lcom/nicron/webview/AsyncObdBridge;->webView:Landroid/webkit/WebView;

    if-eqz v1, :done

    new-instance v2, Lcom/nicron/webview/AsyncObdCallbackRunnable;

    invoke-direct {v2, v1, v0}, Lcom/nicron/webview/AsyncObdCallbackRunnable;-><init>(Landroid/webkit/WebView;Ljava/lang/String;)V

    invoke-virtual {v1, v2}, Landroid/webkit/WebView;->post(Ljava/lang/Runnable;)Z
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_callback

    :done
    return-void

    :catch_callback
    move-exception v0

    return-void
.end method

.method public sendAsync(Ljava/lang/String;ILjava/lang/String;)Ljava/lang/String;
    .locals 4
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    if-eqz p3, :invalid_id

    invoke-virtual {p3}, Ljava/lang/String;->length()I

    move-result v0

    if-lez v0, :invalid_id

    new-instance v0, Lcom/nicron/webview/AsyncObdSendRunnable;

    invoke-direct {v0, p0, p1, p2, p3}, Lcom/nicron/webview/AsyncObdSendRunnable;-><init>(Lcom/nicron/webview/AsyncObdBridge;Ljava/lang/String;ILjava/lang/String;)V

    new-instance v1, Ljava/lang/Thread;

    const-string v2, "IS220d-OBD-send"

    invoke-direct {v1, v0, v2}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;Ljava/lang/String;)V

    invoke-virtual {v1}, Ljava/lang/Thread;->start()V

    const-string v0, "OK"

    return-object v0

    :invalid_id
    new-instance v0, Ljava/lang/IllegalArgumentException;

    const-string v1, "Async request id puuttuu"

    invoke-direct {v0, v1}, Ljava/lang/IllegalArgumentException;-><init>(Ljava/lang/String;)V

    throw v0
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    :catch_0
    move-exception v0

    invoke-static {v0}, Lcom/nicron/webview/AsyncObdBridge;->error(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method

.method public runConnect(Ljava/lang/String;)Ljava/lang/String;
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->delegate:Lcom/nicron/webview/ObdBridge;

    invoke-virtual {v0, p1}, Lcom/nicron/webview/ObdBridge;->connect(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method

.method public runSend(Ljava/lang/String;I)Ljava/lang/String;
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->delegate:Lcom/nicron/webview/ObdBridge;

    invoke-virtual {v0, p1, p2}, Lcom/nicron/webview/ObdBridge;->send(Ljava/lang/String;I)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method
