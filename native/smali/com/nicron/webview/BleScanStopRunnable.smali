.class final Lcom/nicron/webview/BleScanStopRunnable;
.super Ljava/lang/Object;
.implements Ljava/lang/Runnable;
.source "BleScanStopRunnable.java"


# instance fields
.field private final bridge:Lcom/nicron/webview/BleObdBridge;

.field private final callback:Landroid/bluetooth/le/ScanCallback;

.field private final scanner:Landroid/bluetooth/le/BluetoothLeScanner;


# direct methods
.method constructor <init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/BleScanStopRunnable;->bridge:Lcom/nicron/webview/BleObdBridge;

    iput-object p2, p0, Lcom/nicron/webview/BleScanStopRunnable;->scanner:Landroid/bluetooth/le/BluetoothLeScanner;

    iput-object p3, p0, Lcom/nicron/webview/BleScanStopRunnable;->callback:Landroid/bluetooth/le/ScanCallback;

    return-void
.end method


# virtual methods
.method public run()V
    .locals 3

    :try_start_0
    iget-object v0, p0, Lcom/nicron/webview/BleScanStopRunnable;->scanner:Landroid/bluetooth/le/BluetoothLeScanner;

    iget-object v1, p0, Lcom/nicron/webview/BleScanStopRunnable;->callback:Landroid/bluetooth/le/ScanCallback;

    invoke-virtual {v0, v1}, Landroid/bluetooth/le/BluetoothLeScanner;->stopScan(Landroid/bluetooth/le/ScanCallback;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :scan_error

    return-void

    :scan_error
    move-exception v0

    invoke-virtual {v0}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object v1

    if-nez v1, :message_ready

    invoke-virtual {v0}, Ljava/lang/Object;->getClass()Ljava/lang/Class;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/Class;->getSimpleName()Ljava/lang/String;

    move-result-object v1

    :message_ready
    const-string v0, "BLE-haun pysäytys epäonnistui: "

    invoke-virtual {v0, v1}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v0

    iget-object v2, p0, Lcom/nicron/webview/BleScanStopRunnable;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v2, v0}, Lcom/nicron/webview/BleObdBridge;->setScanError(Ljava/lang/String;)V

    return-void
.end method
