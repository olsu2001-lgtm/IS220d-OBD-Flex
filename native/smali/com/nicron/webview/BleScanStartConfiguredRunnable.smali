.class final Lcom/nicron/webview/BleScanStartConfiguredRunnable;
.super Ljava/lang/Object;
.implements Ljava/lang/Runnable;
.source "BleScanStartConfiguredRunnable.java"


# instance fields
.field private final bridge:Lcom/nicron/webview/BleObdBridge;

.field private final callback:Landroid/bluetooth/le/ScanCallback;

.field private final scanner:Landroid/bluetooth/le/BluetoothLeScanner;

.field private final useObdFilter:Z


# direct methods
.method constructor <init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;Z)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->bridge:Lcom/nicron/webview/BleObdBridge;

    iput-object p2, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->scanner:Landroid/bluetooth/le/BluetoothLeScanner;

    iput-object p3, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->callback:Landroid/bluetooth/le/ScanCallback;

    iput-boolean p4, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->useObdFilter:Z

    return-void
.end method


# virtual methods
.method public run()V
    .locals 7

    :try_start_0
    new-instance v0, Landroid/bluetooth/le/ScanSettings$Builder;

    invoke-direct {v0}, Landroid/bluetooth/le/ScanSettings$Builder;-><init>()V

    const/4 v1, 0x2

    invoke-virtual {v0, v1}, Landroid/bluetooth/le/ScanSettings$Builder;->setScanMode(I)Landroid/bluetooth/le/ScanSettings$Builder;

    move-result-object v0

    const/4 v1, 0x1

    invoke-virtual {v0, v1}, Landroid/bluetooth/le/ScanSettings$Builder;->setCallbackType(I)Landroid/bluetooth/le/ScanSettings$Builder;

    move-result-object v0

    const-wide/16 v1, 0x0

    invoke-virtual {v0, v1, v2}, Landroid/bluetooth/le/ScanSettings$Builder;->setReportDelay(J)Landroid/bluetooth/le/ScanSettings$Builder;

    move-result-object v0

    invoke-virtual {v0}, Landroid/bluetooth/le/ScanSettings$Builder;->build()Landroid/bluetooth/le/ScanSettings;

    move-result-object v2

    const/4 v1, 0x0

    iget-boolean v3, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->useObdFilter:Z

    if-eqz v3, :filters_ready

    new-instance v1, Ljava/util/ArrayList;

    invoke-direct {v1}, Ljava/util/ArrayList;-><init>()V

    new-instance v3, Landroid/bluetooth/le/ScanFilter$Builder;

    invoke-direct {v3}, Landroid/bluetooth/le/ScanFilter$Builder;-><init>()V

    const-string v4, "OBD"

    invoke-virtual {v3, v4}, Landroid/bluetooth/le/ScanFilter$Builder;->setDeviceName(Ljava/lang/String;)Landroid/bluetooth/le/ScanFilter$Builder;

    move-result-object v3

    invoke-virtual {v3}, Landroid/bluetooth/le/ScanFilter$Builder;->build()Landroid/bluetooth/le/ScanFilter;

    move-result-object v3

    invoke-interface {v1, v3}, Ljava/util/List;->add(Ljava/lang/Object;)Z

    :filters_ready
    iget-object v0, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->scanner:Landroid/bluetooth/le/BluetoothLeScanner;

    iget-object v3, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->callback:Landroid/bluetooth/le/ScanCallback;

    invoke-virtual {v0, v1, v2, v3}, Landroid/bluetooth/le/BluetoothLeScanner;->startScan(Ljava/util/List;Landroid/bluetooth/le/ScanSettings;Landroid/bluetooth/le/ScanCallback;)V
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
    const-string v0, "Varmistushaun käynnistys epäonnistui: "

    invoke-virtual {v0, v1}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v0

    iget-object v4, p0, Lcom/nicron/webview/BleScanStartConfiguredRunnable;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v4, v0}, Lcom/nicron/webview/BleObdBridge;->setScanError(Ljava/lang/String;)V

    return-void
.end method
