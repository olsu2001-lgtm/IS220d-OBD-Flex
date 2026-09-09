.class final Lcom/nicron/webview/AsyncObdConnectRunnable;
.super Ljava/lang/Object;
.source "AsyncObdConnectRunnable.java"

# interfaces
.implements Ljava/lang/Runnable;


# instance fields
.field private address:Ljava/lang/String;

.field private bridge:Lcom/nicron/webview/AsyncObdBridge;

.field private requestId:Ljava/lang/String;


# direct methods
.method public constructor <init>(Lcom/nicron/webview/AsyncObdBridge;Ljava/lang/String;Ljava/lang/String;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/AsyncObdConnectRunnable;->bridge:Lcom/nicron/webview/AsyncObdBridge;

    iput-object p2, p0, Lcom/nicron/webview/AsyncObdConnectRunnable;->address:Ljava/lang/String;

    iput-object p3, p0, Lcom/nicron/webview/AsyncObdConnectRunnable;->requestId:Ljava/lang/String;

    return-void
.end method


# virtual methods
.method public run()V
    .locals 3

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdConnectRunnable;->bridge:Lcom/nicron/webview/AsyncObdBridge;

    iget-object v1, p0, Lcom/nicron/webview/AsyncObdConnectRunnable;->address:Ljava/lang/String;

    invoke-virtual {v0, v1}, Lcom/nicron/webview/AsyncObdBridge;->runConnect(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v1

    iget-object v2, p0, Lcom/nicron/webview/AsyncObdConnectRunnable;->requestId:Ljava/lang/String;

    invoke-virtual {v0, v2, v1}, Lcom/nicron/webview/AsyncObdBridge;->deliverResult(Ljava/lang/String;Ljava/lang/String;)V

    return-void
.end method
