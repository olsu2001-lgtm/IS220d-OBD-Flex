.class final Lcom/nicron/webview/AsyncObdSendRunnable;
.super Ljava/lang/Object;
.source "AsyncObdSendRunnable.java"

# interfaces
.implements Ljava/lang/Runnable;


# instance fields
.field private bridge:Lcom/nicron/webview/AsyncObdBridge;

.field private command:Ljava/lang/String;

.field private requestId:Ljava/lang/String;

.field private timeoutMs:I


# direct methods
.method public constructor <init>(Lcom/nicron/webview/AsyncObdBridge;Ljava/lang/String;ILjava/lang/String;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->bridge:Lcom/nicron/webview/AsyncObdBridge;

    iput-object p2, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->command:Ljava/lang/String;

    iput p3, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->timeoutMs:I

    iput-object p4, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->requestId:Ljava/lang/String;

    return-void
.end method


# virtual methods
.method public run()V
    .locals 4

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->bridge:Lcom/nicron/webview/AsyncObdBridge;

    iget-object v1, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->command:Ljava/lang/String;

    iget v2, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->timeoutMs:I

    invoke-virtual {v0, v1, v2}, Lcom/nicron/webview/AsyncObdBridge;->runSend(Ljava/lang/String;I)Ljava/lang/String;

    move-result-object v1

    iget-object v2, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->requestId:Ljava/lang/String;

    invoke-virtual {v0, v2, v1}, Lcom/nicron/webview/AsyncObdBridge;->deliverResult(Ljava/lang/String;Ljava/lang/String;)V

    return-void
.end method
