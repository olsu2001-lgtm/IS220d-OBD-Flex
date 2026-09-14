.class public final Lcom/nicron/webview/AsyncObdSendRunnable;
.super Ljava/lang/Object;
.source "AsyncObdSendRunnable.java"

.implements Ljava/lang/Runnable;

# instance fields
.field private final bridge:Lcom/nicron/webview/AsyncObdBridge;
.field private final command:Ljava/lang/String;
.field private final requestId:Ljava/lang/String;
.field private final timeoutMs:I

# direct methods
.method public constructor <init>(Lcom/nicron/webview/AsyncObdBridge;Ljava/lang/String;Ljava/lang/String;I)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->bridge:Lcom/nicron/webview/AsyncObdBridge;
    iput-object p2, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->requestId:Ljava/lang/String;
    iput-object p3, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->command:Ljava/lang/String;
    iput p4, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->timeoutMs:I
    return-void
.end method

# virtual methods
.method public run()V
    .locals 4

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->bridge:Lcom/nicron/webview/AsyncObdBridge;
    iget-object v1, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->requestId:Ljava/lang/String;
    iget-object v2, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->command:Ljava/lang/String;
    iget v3, p0, Lcom/nicron/webview/AsyncObdSendRunnable;->timeoutMs:I

    invoke-virtual {v0, v1, v2, v3}, Lcom/nicron/webview/AsyncObdBridge;->execute(Ljava/lang/String;Ljava/lang/String;I)V
    return-void
.end method
