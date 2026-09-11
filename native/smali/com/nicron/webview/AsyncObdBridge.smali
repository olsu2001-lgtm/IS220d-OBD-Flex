.class public final Lcom/nicron/webview/AsyncObdBridge;
.super Ljava/lang/Object;
.source "AsyncObdBridge.java"

# instance fields
.field private final ble:Lcom/nicron/webview/BleObdBridge;
.field private final classic:Lcom/nicron/webview/ObdBridge;
.field private final results:Ljava/util/concurrent/ConcurrentHashMap;
.field private final sequence:Ljava/util/concurrent/atomic/AtomicInteger;

# direct methods
.method public constructor <init>(Lcom/nicron/webview/ObdBridge;Lcom/nicron/webview/BleObdBridge;)V
    .locals 1

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/AsyncObdBridge;->classic:Lcom/nicron/webview/ObdBridge;
    iput-object p2, p0, Lcom/nicron/webview/AsyncObdBridge;->ble:Lcom/nicron/webview/BleObdBridge;

    new-instance v0, Ljava/util/concurrent/ConcurrentHashMap;
    invoke-direct {v0}, Ljava/util/concurrent/ConcurrentHashMap;-><init>()V
    iput-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->results:Ljava/util/concurrent/ConcurrentHashMap;

    new-instance v0, Ljava/util/concurrent/atomic/AtomicInteger;
    invoke-direct {v0}, Ljava/util/concurrent/atomic/AtomicInteger;-><init>()V
    iput-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->sequence:Ljava/util/concurrent/atomic/AtomicInteger;

    return-void
.end method

.method private start(Ljava/lang/String;Ljava/lang/String;I)Ljava/lang/String;
    .locals 4

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->sequence:Ljava/util/concurrent/atomic/AtomicInteger;
    invoke-virtual {v0}, Ljava/util/concurrent/atomic/AtomicInteger;->incrementAndGet()I
    move-result v0

    invoke-static {v0}, Ljava/lang/Integer;->toString(I)Ljava/lang/String;
    move-result-object v1

    new-instance v2, Lcom/nicron/webview/AsyncObdSendRunnable;
    invoke-direct {v2, p0, p1, v1, p2, p3}, Lcom/nicron/webview/AsyncObdSendRunnable;-><init>(Lcom/nicron/webview/AsyncObdBridge;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;I)V

    new-instance v3, Ljava/lang/Thread;
    invoke-direct {v3, v2}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V
    invoke-virtual {v3}, Ljava/lang/Thread;->start()V

    return-object v1
.end method

# virtual methods
.method public execute(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;I)V
    .locals 3

    :try_start_0
    const-string v0, "ble"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v0

    if-eqz v0, :classic_send

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->ble:Lcom/nicron/webview/BleObdBridge;
    invoke-virtual {v0, p3, p4}, Lcom/nicron/webview/BleObdBridge;->send(Ljava/lang/String;I)Ljava/lang/String;
    move-result-object v1
    goto :store_result

    :classic_send
    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->classic:Lcom/nicron/webview/ObdBridge;
    invoke-virtual {v0, p3, p4}, Lcom/nicron/webview/ObdBridge;->send(Ljava/lang/String;I)Ljava/lang/String;
    move-result-object v1

    :store_result
    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->results:Ljava/util/concurrent/ConcurrentHashMap;
    invoke-virtual {v0, p2, v1}, Ljava/util/concurrent/ConcurrentHashMap;->put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
    move-result-object v2
    :try_end_0
    .catch Ljava/lang/Throwable; {:try_start_0 .. :try_end_0} :catch_0

    return-void

    :catch_0
    move-exception v0
    invoke-virtual {v0}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;
    move-result-object v1
    if-nez v1, :have_message
    invoke-virtual {v0}, Ljava/lang/Object;->getClass()Ljava/lang/Class;
    move-result-object v0
    invoke-virtual {v0}, Ljava/lang/Class;->getSimpleName()Ljava/lang/String;
    move-result-object v1

    :have_message
    const-string v2, "__ERROR__"
    invoke-virtual {v2, v1}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v1
    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->results:Ljava/util/concurrent/ConcurrentHashMap;
    invoke-virtual {v0, p2, v1}, Ljava/util/concurrent/ConcurrentHashMap;->put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
    move-result-object v2
    return-void
.end method

.method public poll(Ljava/lang/String;)Ljava/lang/String;
    .locals 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    iget-object v0, p0, Lcom/nicron/webview/AsyncObdBridge;->results:Ljava/util/concurrent/ConcurrentHashMap;
    invoke-virtual {v0, p1}, Ljava/util/concurrent/ConcurrentHashMap;->remove(Ljava/lang/Object;)Ljava/lang/Object;
    move-result-object v0
    check-cast v0, Ljava/lang/String;

    if-nez v0, :done
    const-string v0, "__PENDING__"

    :done
    return-object v0
.end method

.method public startBle(Ljava/lang/String;I)Ljava/lang/String;
    .locals 1
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    const-string v0, "ble"
    invoke-direct {p0, v0, p1, p2}, Lcom/nicron/webview/AsyncObdBridge;->start(Ljava/lang/String;Ljava/lang/String;I)Ljava/lang/String;
    move-result-object p1
    return-object p1
.end method

.method public startClassic(Ljava/lang/String;I)Ljava/lang/String;
    .locals 1
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    const-string v0, "classic"
    invoke-direct {p0, v0, p1, p2}, Lcom/nicron/webview/AsyncObdBridge;->start(Ljava/lang/String;Ljava/lang/String;I)Ljava/lang/String;
    move-result-object p1
    return-object p1
.end method
