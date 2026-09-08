.class final Lcom/nicron/webview/BleScanCallback;
.super Landroid/bluetooth/le/ScanCallback;
.source "BleScanCallback.java"


# instance fields
.field private final bridge:Lcom/nicron/webview/BleObdBridge;

.field private final devices:Ljava/util/concurrent/ConcurrentHashMap;


# direct methods
.method constructor <init>(Lcom/nicron/webview/BleObdBridge;Ljava/util/concurrent/ConcurrentHashMap;)V
    .locals 0

    invoke-direct {p0}, Landroid/bluetooth/le/ScanCallback;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/BleScanCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    iput-object p2, p0, Lcom/nicron/webview/BleScanCallback;->devices:Ljava/util/concurrent/ConcurrentHashMap;

    return-void
.end method


# virtual methods
.method public onBatchScanResults(Ljava/util/List;)V
    .locals 2

    invoke-interface {p1}, Ljava/util/List;->iterator()Ljava/util/Iterator;

    move-result-object p1

    :loop
    invoke-interface {p1}, Ljava/util/Iterator;->hasNext()Z

    move-result v0

    if-eqz v0, :done

    invoke-interface {p1}, Ljava/util/Iterator;->next()Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/bluetooth/le/ScanResult;

    const/4 v1, 0x0

    invoke-virtual {p0, v1, v0}, Lcom/nicron/webview/BleScanCallback;->onScanResult(ILandroid/bluetooth/le/ScanResult;)V

    goto :loop

    :done
    return-void
.end method

.method public onScanFailed(I)V
    .locals 2

    new-instance v0, Ljava/lang/StringBuilder;

    invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V

    const-string v1, "BLE-haku epäonnistui ("

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v0, p1}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    const-string p1, ")"

    invoke-virtual {v0, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p1

    iget-object v0, p0, Lcom/nicron/webview/BleScanCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v0, p1}, Lcom/nicron/webview/BleObdBridge;->setScanError(Ljava/lang/String;)V

    return-void
.end method

.method public onScanResult(ILandroid/bluetooth/le/ScanResult;)V
    .locals 7

    :try_start_0
    iget-object p1, p0, Lcom/nicron/webview/BleScanCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p1}, Lcom/nicron/webview/BleObdBridge;->noteScanResult()V

    invoke-virtual {p2}, Landroid/bluetooth/le/ScanResult;->getDevice()Landroid/bluetooth/BluetoothDevice;

    move-result-object p1

    if-eqz p1, :done

    invoke-virtual {p1}, Landroid/bluetooth/BluetoothDevice;->getAddress()Ljava/lang/String;

    move-result-object v0

    if-eqz v0, :done

    invoke-virtual {p2}, Landroid/bluetooth/le/ScanResult;->getScanRecord()Landroid/bluetooth/le/ScanRecord;

    move-result-object v5

    const/4 v6, 0x0

    if-eqz v5, :cached_name

    invoke-virtual {v5}, Landroid/bluetooth/le/ScanRecord;->getDeviceName()Ljava/lang/String;

    move-result-object v6

    :cached_name
    if-nez v6, :name_from_record

    const-string p1, "Nimetön BLE-laite"

    goto :name_selected

    :name_from_record
    move-object p1, v6

    :name_selected
    if-nez p1, :name_ok

    const-string p1, "Nimetön BLE-laite"

    :name_ok
    new-instance v1, Lorg/json/JSONObject;

    invoke-direct {v1}, Lorg/json/JSONObject;-><init>()V

    const-string v2, "name"

    invoke-virtual {v1, v2, p1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string p1, "address"

    invoke-virtual {v1, p1, v0}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string p1, "transport"

    const-string v2, "ble"

    invoke-virtual {v1, p1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string p1, "rssi"

    invoke-virtual {p2}, Landroid/bluetooth/le/ScanResult;->getRssi()I

    move-result p2

    invoke-virtual {v1, p1, p2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    if-eqz v5, :store_result

    invoke-virtual {v5}, Landroid/bluetooth/le/ScanRecord;->getServiceUuids()Ljava/util/List;

    move-result-object p1

    if-eqz p1, :store_result

    invoke-interface {p1}, Ljava/util/List;->isEmpty()Z

    move-result p2

    if-nez p2, :store_result

    const-string p2, "services"

    invoke-interface {p1}, Ljava/util/List;->toString()Ljava/lang/String;

    move-result-object p1

    invoke-virtual {v1, p2, p1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    :store_result
    iget-object p1, p0, Lcom/nicron/webview/BleScanCallback;->devices:Ljava/util/concurrent/ConcurrentHashMap;

    invoke-virtual {p1, v0, v1}, Ljava/util/concurrent/ConcurrentHashMap;->put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :scan_result_error

    goto :done

    :scan_result_error
    move-exception p1

    invoke-virtual {p1}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object p2

    if-nez p2, :scan_error_message

    invoke-virtual {p1}, Ljava/lang/Object;->getClass()Ljava/lang/Class;

    move-result-object p1

    invoke-virtual {p1}, Ljava/lang/Class;->getSimpleName()Ljava/lang/String;

    move-result-object p2

    :scan_error_message
    const-string p1, "BLE-hakutulosta ei voitu käsitellä: "

    invoke-virtual {p1, p2}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    iget-object p2, p0, Lcom/nicron/webview/BleScanCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, p1}, Lcom/nicron/webview/BleObdBridge;->setScanError(Ljava/lang/String;)V

    :done
    return-void
.end method
