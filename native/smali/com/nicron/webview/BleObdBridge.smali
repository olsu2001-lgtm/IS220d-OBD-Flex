.class public final Lcom/nicron/webview/BleObdBridge;
.super Ljava/lang/Object;
.source "BleObdBridge.java"


# instance fields
.field private final activity:Landroid/app/Activity;

.field private volatile connected:Z

.field private cccdValue:Ljava/lang/String;

.field private volatile connectionError:Ljava/lang/String;

.field private volatile connectionState:I

.field private deviceAddress:Ljava/lang/String;

.field private deviceName:Ljava/lang/String;

.field private gatt:Landroid/bluetooth/BluetoothGatt;

.field private gattUuids:Ljava/lang/String;

.field private lastGattEvent:Ljava/lang/String;

.field private volatile notificationEnabled:Z

.field private notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

.field private volatile payloadSize:I

.field private volatile response:Ljava/lang/StringBuffer;

.field private volatile responseChunkCount:I

.field private volatile responseChunks:Ljava/lang/StringBuffer;

.field private volatile quicklynksBinary:Z

.field private volatile scanCallbackCount:I

.field private volatile scanDefaultCallbacks:I

.field private volatile scanError:Ljava/lang/String;

.field private volatile scanLowLatencyCallbacks:I

.field private volatile scanObdFilterCallbacks:I

.field private scanModeUsed:Ljava/lang/String;

.field private volatile scanStartedAt:J

.field private volatile scanStoppedAt:J

.field private transportProfile:Ljava/lang/String;

.field private writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

.field private writeType:I


# direct methods
.method public constructor <init>(Landroid/app/Activity;)V
    .locals 2

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->activity:Landroid/app/Activity;

    const/16 p1, 0x14

    iput p1, p0, Lcom/nicron/webview/BleObdBridge;->payloadSize:I

    new-instance p1, Ljava/lang/StringBuffer;

    invoke-direct {p1}, Ljava/lang/StringBuffer;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->response:Ljava/lang/StringBuffer;

    new-instance p1, Ljava/lang/StringBuffer;

    invoke-direct {p1}, Ljava/lang/StringBuffer;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->responseChunks:Ljava/lang/StringBuffer;

    const-string p1, "BLE-silta luotu"

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    const-string p1, ""

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->gattUuids:Ljava/lang/String;

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->cccdValue:Ljava/lang/String;

    const/4 p1, -0x1

    iput p1, p0, Lcom/nicron/webview/BleObdBridge;->scanDefaultCallbacks:I

    iput p1, p0, Lcom/nicron/webview/BleObdBridge;->scanLowLatencyCallbacks:I

    iput p1, p0, Lcom/nicron/webview/BleObdBridge;->scanObdFilterCallbacks:I

    const-string p1, "ei vielä ajettu"

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->scanModeUsed:Ljava/lang/String;

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

.method private static errorText(Ljava/lang/String;)Ljava/lang/String;
    .locals 1

    const-string v0, "__ERROR__"

    invoke-virtual {v0, p0}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p0

    return-object p0
.end method

.method private static findCharacteristic(Landroid/bluetooth/BluetoothGatt;Ljava/lang/String;Ljava/lang/String;)Landroid/bluetooth/BluetoothGattCharacteristic;
    .locals 0

    invoke-static {p1}, Ljava/util/UUID;->fromString(Ljava/lang/String;)Ljava/util/UUID;

    move-result-object p1

    invoke-virtual {p0, p1}, Landroid/bluetooth/BluetoothGatt;->getService(Ljava/util/UUID;)Landroid/bluetooth/BluetoothGattService;

    move-result-object p0

    if-nez p0, :service_found

    const/4 p0, 0x0

    return-object p0

    :service_found
    invoke-static {p2}, Ljava/util/UUID;->fromString(Ljava/lang/String;)Ljava/util/UUID;

    move-result-object p1

    invoke-virtual {p0, p1}, Landroid/bluetooth/BluetoothGattService;->getCharacteristic(Ljava/util/UUID;)Landroid/bluetooth/BluetoothGattCharacteristic;

    move-result-object p0

    return-object p0
.end method

.method private static jsonError(Ljava/lang/String;)Ljava/lang/String;
    .locals 3

    :try_start_0
    new-instance v0, Lorg/json/JSONObject;

    invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V

    const-string v1, "ok"

    const/4 v2, 0x0

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    const-string v1, "error"

    invoke-virtual {v0, v1, p0}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;

    move-result-object p0
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :json_error

    return-object p0

    :json_error
    move-exception v0

    invoke-static {p0}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p0

    return-object p0
.end method

.method private jsonSuccess()Ljava/lang/String;
    .locals 4

    :try_start_0
    new-instance v0, Lorg/json/JSONObject;

    invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V

    const-string v1, "ok"

    const/4 v2, 0x1

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    const-string v1, "name"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->deviceName:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "address"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->deviceAddress:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "transport"

    const-string v2, "ble"

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "transportProfile"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "binaryProtocol"

    iget-boolean v2, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    const-string v1, "gattUuids"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->gattUuids:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    if-eqz v2, :no_write_uuid

    invoke-virtual {v2}, Landroid/bluetooth/BluetoothGattCharacteristic;->getUuid()Ljava/util/UUID;

    move-result-object v2

    invoke-virtual {v2}, Ljava/util/UUID;->toString()Ljava/lang/String;

    move-result-object v2

    const-string v1, "writeUuid"

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    :no_write_uuid
    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    if-eqz v2, :no_notify_uuid

    invoke-virtual {v2}, Landroid/bluetooth/BluetoothGattCharacteristic;->getUuid()Ljava/util/UUID;

    move-result-object v2

    invoke-virtual {v2}, Ljava/util/UUID;->toString()Ljava/lang/String;

    move-result-object v2

    const-string v1, "notifyUuid"

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    :no_notify_uuid
    const-string v1, "notificationEnabled"

    iget-boolean v2, p0, Lcom/nicron/webview/BleObdBridge;->notificationEnabled:Z

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    const-string v1, "cccdValue"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->cccdValue:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "payloadSize"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->payloadSize:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    const-string v1, "writeType"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->writeType:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;

    move-result-object v0
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :json_error

    return-object v0

    :json_error
    move-exception v0

    invoke-static {v0}, Lcom/nicron/webview/BleObdBridge;->error(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method


# virtual methods
.method public appendResponse([B)V
    .locals 3

    :try_start_0
    iget-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    if-eqz v0, :ascii_response

    invoke-static {p1}, Lcom/nicron/webview/QuicklynksCodec;->bytesToHex([B)Ljava/lang/String;

    move-result-object v0

    goto :append_value

    :ascii_response
    new-instance v0, Ljava/lang/String;

    const-string v1, "US-ASCII"

    invoke-direct {v0, p1, v1}, Ljava/lang/String;-><init>([BLjava/lang/String;)V

    :append_value
    iget-object p1, p0, Lcom/nicron/webview/BleObdBridge;->response:Ljava/lang/StringBuffer;

    if-eqz p1, :done

    invoke-virtual {p1, v0}, Ljava/lang/StringBuffer;->append(Ljava/lang/String;)Ljava/lang/StringBuffer;

    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->responseChunks:Ljava/lang/StringBuffer;

    if-eqz v1, :chunk_count

    invoke-virtual {v1}, Ljava/lang/StringBuffer;->length()I

    move-result v2

    if-lez v2, :append_chunk

    const-string v2, "|"

    invoke-virtual {v1, v2}, Ljava/lang/StringBuffer;->append(Ljava/lang/String;)Ljava/lang/StringBuffer;

    :append_chunk
    invoke-virtual {v1, v0}, Ljava/lang/StringBuffer;->append(Ljava/lang/String;)Ljava/lang/StringBuffer;

    :chunk_count
    iget v1, p0, Lcom/nicron/webview/BleObdBridge;->responseChunkCount:I

    add-int/lit8 v1, v1, 0x1

    iput v1, p0, Lcom/nicron/webview/BleObdBridge;->responseChunkCount:I
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :append_error

    goto :done

    :append_error
    move-exception p1

    :done
    return-void
.end method

.method public configureGatt(Landroid/bluetooth/BluetoothGatt;)V
    .locals 10

    :try_start_0
    const/4 v0, 0x0

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    const/4 v1, 0x0

    iput-boolean v1, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    iput-boolean v1, p0, Lcom/nicron/webview/BleObdBridge;->notificationEnabled:Z

    const-string v1, ""

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->cccdValue:Ljava/lang/String;

    const-string v1, "Palvelut löydetty; ominaisuudet tunnistetaan"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    const-string v1, "0000fff0-0000-1000-8000-00805f9b34fb"

    const-string v2, "0000fff6-0000-1000-8000-00805f9b34fb"

    invoke-static {p1, v1, v2}, Lcom/nicron/webview/BleObdBridge;->findCharacteristic(Landroid/bluetooth/BluetoothGatt;Ljava/lang/String;Ljava/lang/String;)Landroid/bluetooth/BluetoothGattCharacteristic;

    move-result-object v4

    if-eqz v4, :try_legacy_fff

    invoke-virtual {v4}, Landroid/bluetooth/BluetoothGattCharacteristic;->getProperties()I

    move-result v5

    and-int/lit8 v6, v5, 0x4

    if-eqz v6, :quicklynks_properties_invalid

    and-int/lit8 v6, v5, 0x10

    if-nez v6, :quicklynks_properties_ok

    :quicklynks_properties_invalid
    const-string p1, "Quicklynks FFF6 ei ilmoita Notify + Write Without Response -ominaisuuksia"

    invoke-virtual {p0, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void

    :quicklynks_properties_ok
    iput-object v4, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v4, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    const/4 v2, 0x1

    iput-boolean v2, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    const-string v2, "Quicklynks FFF0/FFF6 · binääri"

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    const-string v2, "0000fff0-0000-1000-8000-00805f9b34fb; 0000fff6-0000-1000-8000-00805f9b34fb; 00002902-0000-1000-8000-00805f9b34fb"

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->gattUuids:Ljava/lang/String;

    goto :characteristics_ready

    :try_legacy_fff
    const-string v3, "0000fff1-0000-1000-8000-00805f9b34fb"

    invoke-static {p1, v1, v3}, Lcom/nicron/webview/BleObdBridge;->findCharacteristic(Landroid/bluetooth/BluetoothGatt;Ljava/lang/String;Ljava/lang/String;)Landroid/bluetooth/BluetoothGattCharacteristic;

    move-result-object v3

    if-eqz v3, :try_split_fff

    invoke-virtual {v3}, Landroid/bluetooth/BluetoothGattCharacteristic;->getProperties()I

    move-result v4

    and-int/lit8 v5, v4, 0xc

    if-eqz v5, :try_split_fff

    and-int/lit8 v4, v4, 0x30

    if-eqz v4, :try_split_fff

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    const-string v2, "FFF0 · FFF1 yhdistetty UART"

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    const-string v2, "0000fff0-0000-1000-8000-00805f9b34fb; 0000fff1-0000-1000-8000-00805f9b34fb"

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->gattUuids:Ljava/lang/String;

    goto :characteristics_ready

    :try_split_fff
    const-string v2, "0000fff2-0000-1000-8000-00805f9b34fb"

    invoke-static {p1, v1, v2}, Lcom/nicron/webview/BleObdBridge;->findCharacteristic(Landroid/bluetooth/BluetoothGatt;Ljava/lang/String;Ljava/lang/String;)Landroid/bluetooth/BluetoothGattCharacteristic;

    move-result-object v2

    if-eqz v2, :try_ffe

    if-eqz v3, :try_ffe

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    const-string v1, "FFF0 · FFF2\u2192FFF1"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    const-string v1, "0000fff0-0000-1000-8000-00805f9b34fb; 0000fff2-0000-1000-8000-00805f9b34fb; 0000fff1-0000-1000-8000-00805f9b34fb"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->gattUuids:Ljava/lang/String;

    goto :characteristics_ready

    :try_ffe
    const-string v1, "0000ffe0-0000-1000-8000-00805f9b34fb"

    const-string v2, "0000ffe1-0000-1000-8000-00805f9b34fb"

    invoke-static {p1, v1, v2}, Lcom/nicron/webview/BleObdBridge;->findCharacteristic(Landroid/bluetooth/BluetoothGatt;Ljava/lang/String;Ljava/lang/String;)Landroid/bluetooth/BluetoothGattCharacteristic;

    move-result-object v2

    if-eqz v2, :try_nus

    invoke-virtual {v2}, Landroid/bluetooth/BluetoothGattCharacteristic;->getProperties()I

    move-result v1

    and-int/lit8 v3, v1, 0xc

    if-eqz v3, :try_nus

    and-int/lit8 v1, v1, 0x30

    if-eqz v1, :try_nus

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    const-string v1, "FFE0 · FFE1"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    goto :characteristics_ready

    :try_nus
    const-string v1, "6e400001-b5a3-f393-e0a9-e50e24dcca9e"

    const-string v2, "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

    invoke-static {p1, v1, v2}, Lcom/nicron/webview/BleObdBridge;->findCharacteristic(Landroid/bluetooth/BluetoothGatt;Ljava/lang/String;Ljava/lang/String;)Landroid/bluetooth/BluetoothGattCharacteristic;

    move-result-object v2

    const-string v3, "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

    invoke-static {p1, v1, v3}, Lcom/nicron/webview/BleObdBridge;->findCharacteristic(Landroid/bluetooth/BluetoothGatt;Ljava/lang/String;Ljava/lang/String;)Landroid/bluetooth/BluetoothGattCharacteristic;

    move-result-object v3

    if-eqz v2, :generic_services

    if-eqz v3, :generic_services

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    const-string v1, "Nordic UART"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    goto :characteristics_ready

    :generic_services
    invoke-virtual {p1}, Landroid/bluetooth/BluetoothGatt;->getServices()Ljava/util/List;

    move-result-object v1

    invoke-interface {v1}, Ljava/util/List;->iterator()Ljava/util/Iterator;

    move-result-object v1

    :service_loop
    invoke-interface {v1}, Ljava/util/Iterator;->hasNext()Z

    move-result v2

    if-eqz v2, :characteristics_ready

    invoke-interface {v1}, Ljava/util/Iterator;->next()Ljava/lang/Object;

    move-result-object v2

    check-cast v2, Landroid/bluetooth/BluetoothGattService;

    invoke-virtual {v2}, Landroid/bluetooth/BluetoothGattService;->getCharacteristics()Ljava/util/List;

    move-result-object v2

    const/4 v3, 0x0

    const/4 v4, 0x0

    invoke-interface {v2}, Ljava/util/List;->iterator()Ljava/util/Iterator;

    move-result-object v2

    :characteristic_loop
    invoke-interface {v2}, Ljava/util/Iterator;->hasNext()Z

    move-result v5

    if-eqz v5, :generic_service_done

    invoke-interface {v2}, Ljava/util/Iterator;->next()Ljava/lang/Object;

    move-result-object v5

    check-cast v5, Landroid/bluetooth/BluetoothGattCharacteristic;

    invoke-virtual {v5}, Landroid/bluetooth/BluetoothGattCharacteristic;->getProperties()I

    move-result v6

    if-nez v3, :generic_notify

    and-int/lit8 v7, v6, 0xc

    if-eqz v7, :generic_notify

    move-object v3, v5

    :generic_notify
    if-nez v4, :generic_next

    and-int/lit8 v6, v6, 0x30

    if-eqz v6, :generic_next

    move-object v4, v5

    :generic_next
    goto :characteristic_loop

    :generic_service_done
    if-eqz v3, :service_loop

    if-eqz v4, :service_loop

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v4, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    const-string v1, "Automaattinen GATT"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    :characteristics_ready
    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    if-eqz v1, :missing_serial

    if-nez v2, :serial_found

    :missing_serial
    const-string p1, "BLE-sarjapalvelua ei löytynyt (kirjoitus- ja ilmoitusominaisuudet puuttuvat)"

    invoke-virtual {p0, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void

    :serial_found
    invoke-virtual {v1}, Landroid/bluetooth/BluetoothGattCharacteristic;->getProperties()I

    move-result v3

    and-int/lit8 v3, v3, 0x4

    if-eqz v3, :write_with_response

    const/4 v3, 0x1

    goto :write_type_ready

    :write_with_response
    const/4 v3, 0x2

    :write_type_ready
    iput v3, p0, Lcom/nicron/webview/BleObdBridge;->writeType:I

    invoke-virtual {v1, v3}, Landroid/bluetooth/BluetoothGattCharacteristic;->setWriteType(I)V

    const/4 v3, 0x1

    invoke-virtual {p1, v2, v3}, Landroid/bluetooth/BluetoothGatt;->setCharacteristicNotification(Landroid/bluetooth/BluetoothGattCharacteristic;Z)Z

    move-result v1

    if-nez v1, :notification_local_ok

    const-string p1, "BLE-ilmoituksia ei voitu ottaa käyttöön"

    invoke-virtual {p0, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void

    :notification_local_ok
    const-string v1, "00002902-0000-1000-8000-00805f9b34fb"

    invoke-static {v1}, Ljava/util/UUID;->fromString(Ljava/lang/String;)Ljava/util/UUID;

    move-result-object v1

    invoke-virtual {v2, v1}, Landroid/bluetooth/BluetoothGattCharacteristic;->getDescriptor(Ljava/util/UUID;)Landroid/bluetooth/BluetoothGattDescriptor;

    move-result-object v1

    if-nez v1, :descriptor_found

    iget-boolean v3, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    if-eqz v3, :descriptor_optional

    const-string p1, "Quicklynks FFF6 CCCD 2902 puuttuu"

    invoke-virtual {p0, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void

    :descriptor_optional
    invoke-virtual {p0}, Lcom/nicron/webview/BleObdBridge;->markReady()V

    return-void

    :descriptor_found
    const-string v3, "CCCD 2902 löytyi; kirjoitetaan ilmoitusarvo"

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    iget-boolean v3, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    if-nez v3, :use_notification

    invoke-virtual {v2}, Landroid/bluetooth/BluetoothGattCharacteristic;->getProperties()I

    move-result v2

    and-int/lit8 v2, v2, 0x10

    if-eqz v2, :use_indication

    :use_notification
    const-string v3, "0100"

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->cccdValue:Ljava/lang/String;

    sget-object v2, Landroid/bluetooth/BluetoothGattDescriptor;->ENABLE_NOTIFICATION_VALUE:[B

    goto :descriptor_value_ready

    :use_indication
    const-string v3, "0200"

    iput-object v3, p0, Lcom/nicron/webview/BleObdBridge;->cccdValue:Ljava/lang/String;

    sget-object v2, Landroid/bluetooth/BluetoothGattDescriptor;->ENABLE_INDICATION_VALUE:[B

    :descriptor_value_ready
    invoke-virtual {v1, v2}, Landroid/bluetooth/BluetoothGattDescriptor;->setValue([B)Z

    move-result v2

    if-eqz v2, :descriptor_failed

    invoke-virtual {p1, v1}, Landroid/bluetooth/BluetoothGatt;->writeDescriptor(Landroid/bluetooth/BluetoothGattDescriptor;)Z

    move-result p1

    if-nez p1, :done

    :descriptor_failed
    const-string p1, "BLE-ilmoitusasetusta ei voitu kirjoittaa"

    invoke-virtual {p0, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :configure_error

    :done
    return-void

    :configure_error
    move-exception p1

    invoke-virtual {p1}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object v0

    if-nez v0, :configure_message_ok

    const-string v0, "BLE-palvelun käyttöönotto epäonnistui"

    :configure_message_ok
    invoke-virtual {p0, v0}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void
.end method

.method public connect(Ljava/lang/String;)Ljava/lang/String;
    .locals 9
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    invoke-virtual {p0}, Lcom/nicron/webview/BleObdBridge;->disconnect()V

    const-wide/16 v0, 0xb4

    invoke-static {v0, v1}, Landroid/os/SystemClock;->sleep(J)V

    invoke-static {}, Landroid/bluetooth/BluetoothAdapter;->getDefaultAdapter()Landroid/bluetooth/BluetoothAdapter;

    move-result-object v0

    if-nez v0, :adapter_found

    const-string p1, "Bluetooth ei ole käytettävissä"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->jsonError(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :adapter_found
    invoke-virtual {v0}, Landroid/bluetooth/BluetoothAdapter;->isEnabled()Z

    move-result v1

    if-nez v1, :adapter_enabled

    const-string p1, "Bluetooth ei ole päällä"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->jsonError(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :adapter_enabled
    invoke-virtual {v0, p1}, Landroid/bluetooth/BluetoothAdapter;->getRemoteDevice(Ljava/lang/String;)Landroid/bluetooth/BluetoothDevice;

    move-result-object v0

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->deviceAddress:Ljava/lang/String;

    invoke-virtual {v0}, Landroid/bluetooth/BluetoothDevice;->getName()Ljava/lang/String;

    move-result-object p1

    if-nez p1, :name_ready

    const-string p1, "BLE327"

    :name_ready
    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->deviceName:Ljava/lang/String;

    const/4 p1, 0x1

    iput p1, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const/4 p1, 0x0

    iput-boolean p1, p0, Lcom/nicron/webview/BleObdBridge;->connected:Z

    const/4 v1, 0x0

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->connectionError:Ljava/lang/String;

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    const-string v1, ""

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->gattUuids:Ljava/lang/String;

    const-string v1, "GATT connectGatt käynnistetty"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    new-instance v2, Lcom/nicron/webview/BleGattCallback;

    invoke-direct {v2, p0}, Lcom/nicron/webview/BleGattCallback;-><init>(Lcom/nicron/webview/BleObdBridge;)V

    sget v3, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v4, 0x17

    if-lt v3, v4, :legacy_connect

    iget-object v3, p0, Lcom/nicron/webview/BleObdBridge;->activity:Landroid/app/Activity;

    const/4 v4, 0x2

    invoke-virtual {v0, v3, p1, v2, v4}, Landroid/bluetooth/BluetoothDevice;->connectGatt(Landroid/content/Context;ZLandroid/bluetooth/BluetoothGattCallback;I)Landroid/bluetooth/BluetoothGatt;

    move-result-object v0

    goto :gatt_created

    :legacy_connect
    iget-object v3, p0, Lcom/nicron/webview/BleObdBridge;->activity:Landroid/app/Activity;

    invoke-virtual {v0, v3, p1, v2}, Landroid/bluetooth/BluetoothDevice;->connectGatt(Landroid/content/Context;ZLandroid/bluetooth/BluetoothGattCallback;)Landroid/bluetooth/BluetoothGatt;

    move-result-object v0

    :gatt_created
    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    if-nez v0, :wait_start

    const-string p1, "BLE GATT -yhteyttä ei voitu avata"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->jsonError(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :wait_start
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v0

    :wait_loop
    iget p1, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const/4 v2, 0x3

    if-ne p1, v2, :check_error

    invoke-direct {p0}, Lcom/nicron/webview/BleObdBridge;->jsonSuccess()Ljava/lang/String;

    move-result-object p1

    return-object p1

    :check_error
    const/4 v2, -0x1

    if-ne p1, v2, :check_timeout

    iget-object p1, p0, Lcom/nicron/webview/BleObdBridge;->connectionError:Ljava/lang/String;

    if-nez p1, :connection_error_ready

    const-string p1, "BLE-yhteys epäonnistui"

    :connection_error_ready
    move-object v8, p1

    invoke-virtual {p0}, Lcom/nicron/webview/BleObdBridge;->disconnect()V

    invoke-static {v8}, Lcom/nicron/webview/BleObdBridge;->jsonError(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :check_timeout
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v2

    sub-long/2addr v2, v0

    const-wide/16 v4, 0x2ee0

    cmp-long p1, v2, v4

    if-ltz p1, :wait_more

    const-string p1, "BLE-yhteyden muodostus aikakatkaistiin"

    invoke-virtual {p0, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    goto :wait_loop

    :wait_more
    const-wide/16 v2, 0x19

    invoke-static {v2, v3}, Landroid/os/SystemClock;->sleep(J)V

    goto :wait_loop
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :connect_error

    :connect_error
    move-exception p1

    invoke-virtual {p1}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object v0

    if-nez v0, :connect_message_ready

    invoke-virtual {p1}, Ljava/lang/Object;->getClass()Ljava/lang/Class;

    move-result-object p1

    invoke-virtual {p1}, Ljava/lang/Class;->getSimpleName()Ljava/lang/String;

    move-result-object v0

    :connect_message_ready
    invoke-virtual {p0}, Lcom/nicron/webview/BleObdBridge;->disconnect()V

    invoke-static {v0}, Lcom/nicron/webview/BleObdBridge;->jsonError(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1
.end method

.method public disconnect()V
    .locals 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    const/4 v0, 0x0

    iput v0, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    iput-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->connected:Z

    iput-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->notificationEnabled:Z

    iput-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    iget-object v0, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    if-eqz v0, :clear

    :try_start_0
    invoke-virtual {v0}, Landroid/bluetooth/BluetoothGatt;->disconnect()V

    invoke-virtual {v0}, Landroid/bluetooth/BluetoothGatt;->close()V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :disconnect_error

    goto :clear

    :disconnect_error
    move-exception v0

    :clear
    const/4 v0, 0x0

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->connectionError:Ljava/lang/String;

    const-string v1, "GATT suljettu"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    const-string v1, ""

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->cccdValue:Ljava/lang/String;

    new-instance v0, Ljava/lang/StringBuffer;

    invoke-direct {v0}, Ljava/lang/StringBuffer;-><init>()V

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->response:Ljava/lang/StringBuffer;

    new-instance v0, Ljava/lang/StringBuffer;

    invoke-direct {v0}, Ljava/lang/StringBuffer;-><init>()V

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->responseChunks:Ljava/lang/StringBuffer;

    const/4 v0, 0x0

    iput v0, p0, Lcom/nicron/webview/BleObdBridge;->responseChunkCount:I

    const/16 v0, 0x14

    iput v0, p0, Lcom/nicron/webview/BleObdBridge;->payloadSize:I

    return-void
.end method

.method public fail(Ljava/lang/String;)V
    .locals 1

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->connectionError:Ljava/lang/String;

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    const/4 p1, -0x1

    iput p1, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const/4 v0, 0x0

    iput-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->connected:Z

    return-void
.end method

.method public handleConnected(Landroid/bluetooth/BluetoothGatt;)V
    .locals 2

    :try_start_0
    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    const/4 v0, 0x1

    iput-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->connected:Z

    const/4 v0, 0x2

    iput v0, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const-string v0, "GATT yhdistetty; discoverServices käynnistyy"

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    invoke-virtual {p1}, Landroid/bluetooth/BluetoothGatt;->discoverServices()Z

    move-result p1

    if-nez p1, :done

    const-string p1, "BLE-palveluiden hakua ei voitu käynnistää"

    invoke-virtual {p0, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :connected_error

    :done
    return-void

    :connected_error
    move-exception p1

    invoke-virtual {p1}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object v0

    if-nez v0, :connected_message_ready

    const-string v0, "BLE-palveluiden haku epäonnistui"

    :connected_message_ready
    invoke-virtual {p0, v0}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void
.end method

.method public handleDisconnected(Landroid/bluetooth/BluetoothGatt;)V
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    if-ne p1, v0, :stale_callback

    iget v0, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    if-nez v0, :unexpected

    return-void

    :unexpected
    const-string v0, "BLE-yhteys katkesi"

    invoke-virtual {p0, v0}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    :stale_callback
    return-void
.end method

.method public isConnected()Z
    .locals 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    iget-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->connected:Z

    if-eqz v0, :not_connected

    iget v0, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const/4 v1, 0x3

    if-ne v0, v1, :not_connected

    const/4 v0, 0x1

    return v0

    :not_connected
    const/4 v0, 0x0

    return v0
.end method

.method public markReady()V
    .locals 2

    const/4 v0, 0x1

    iput-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->connected:Z

    const/4 v0, 0x3

    iput v0, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const/4 v0, 0x1

    iput-boolean v0, p0, Lcom/nicron/webview/BleObdBridge;->notificationEnabled:Z

    const-string v0, "GATT ja notification/CCCD valmiit"

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    if-eqz v1, :ready_done

    const/4 v0, 0x1

    invoke-virtual {v1, v0}, Landroid/bluetooth/BluetoothGatt;->requestConnectionPriority(I)Z

    move-result v0

    const/16 v0, 0x205

    invoke-virtual {v1, v0}, Landroid/bluetooth/BluetoothGatt;->requestMtu(I)Z

    move-result v0

    :ready_done

    return-void
.end method

.method public ownsGatt(Landroid/bluetooth/BluetoothGatt;)Z
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    if-eqz v0, :unassigned

    if-ne v0, p1, :not_owned

    :unassigned
    const/4 p1, 0x1

    return p1

    :not_owned
    const/4 p1, 0x0

    return p1
.end method

.method public scanDevices(I)Ljava/lang/String;
    .locals 10
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    const/4 v0, 0x0

    iput-object v0, p0, Lcom/nicron/webview/BleObdBridge;->scanError:Ljava/lang/String;

    const/4 v1, -0x1

    iput v1, p0, Lcom/nicron/webview/BleObdBridge;->scanDefaultCallbacks:I

    iput v1, p0, Lcom/nicron/webview/BleObdBridge;->scanLowLatencyCallbacks:I

    iput v1, p0, Lcom/nicron/webview/BleObdBridge;->scanObdFilterCallbacks:I

    const-string v1, "ei vielä käynnistetty"

    iput-object v1, p0, Lcom/nicron/webview/BleObdBridge;->scanModeUsed:Ljava/lang/String;

    invoke-static {}, Landroid/bluetooth/BluetoothAdapter;->getDefaultAdapter()Landroid/bluetooth/BluetoothAdapter;

    move-result-object v0

    if-nez v0, :adapter_found

    const-string p1, "Bluetooth ei ole käytettävissä"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :adapter_found
    invoke-virtual {v0}, Landroid/bluetooth/BluetoothAdapter;->isEnabled()Z

    move-result v1

    if-nez v1, :adapter_enabled

    const-string p1, "Bluetooth ei ole päällä"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :adapter_enabled
    invoke-virtual {v0}, Landroid/bluetooth/BluetoothAdapter;->getBluetoothLeScanner()Landroid/bluetooth/le/BluetoothLeScanner;

    move-result-object v0

    if-nez v0, :scanner_found

    const-string p1, "BLE-hakua ei voitu käynnistää"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :scanner_found
    const/4 v1, 0x0

    iput v1, p0, Lcom/nicron/webview/BleObdBridge;->scanCallbackCount:I

    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v4

    iput-wide v4, p0, Lcom/nicron/webview/BleObdBridge;->scanStartedAt:J

    new-instance v1, Ljava/util/concurrent/ConcurrentHashMap;

    invoke-direct {v1}, Ljava/util/concurrent/ConcurrentHashMap;-><init>()V

    new-instance v2, Lcom/nicron/webview/BleScanCallback;

    invoke-direct {v2, p0, v1}, Lcom/nicron/webview/BleScanCallback;-><init>(Lcom/nicron/webview/BleObdBridge;Ljava/util/concurrent/ConcurrentHashMap;)V

    const/16 v3, 0xbb8

    if-ge p1, v3, :min_timeout_ok

    move p1, v3

    :min_timeout_ok
    const/16 v3, 0x7530

    if-le p1, v3, :max_timeout_ok

    move p1, v3

    :max_timeout_ok
    div-int/lit8 v3, p1, 0x3

    const-string v4, "1/3 suodattamaton oletushaku"

    iput-object v4, p0, Lcom/nicron/webview/BleObdBridge;->scanModeUsed:Ljava/lang/String;

    new-instance v6, Lcom/nicron/webview/BleScanStartSimpleRunnable;

    invoke-direct {v6, p0, v0, v2}, Lcom/nicron/webview/BleScanStartSimpleRunnable;-><init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;)V

    iget-object v7, p0, Lcom/nicron/webview/BleObdBridge;->activity:Landroid/app/Activity;

    invoke-virtual {v7, v6}, Landroid/app/Activity;->runOnUiThread(Ljava/lang/Runnable;)V

    int-to-long v4, v3

    invoke-static {v4, v5}, Landroid/os/SystemClock;->sleep(J)V

    new-instance v6, Lcom/nicron/webview/BleScanStopRunnable;

    invoke-direct {v6, p0, v0, v2}, Lcom/nicron/webview/BleScanStopRunnable;-><init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;)V

    invoke-virtual {v7, v6}, Landroid/app/Activity;->runOnUiThread(Ljava/lang/Runnable;)V

    const-wide/16 v4, 0x78

    invoke-static {v4, v5}, Landroid/os/SystemClock;->sleep(J)V

    iget v8, p0, Lcom/nicron/webview/BleObdBridge;->scanCallbackCount:I

    iput v8, p0, Lcom/nicron/webview/BleObdBridge;->scanDefaultCallbacks:I

    if-lez v8, :phase_low_latency

    goto :scan_complete

    :phase_low_latency
    const/4 v9, 0x0

    iput-object v9, p0, Lcom/nicron/webview/BleObdBridge;->scanError:Ljava/lang/String;

    const-string v4, "2/3 LOW_LATENCY ilman suodatinta"

    iput-object v4, p0, Lcom/nicron/webview/BleObdBridge;->scanModeUsed:Ljava/lang/String;

    new-instance v6, Lcom/nicron/webview/BleScanStartConfiguredRunnable;

    const/4 v9, 0x0

    invoke-direct {v6, p0, v0, v2, v9}, Lcom/nicron/webview/BleScanStartConfiguredRunnable;-><init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;Z)V

    invoke-virtual {v7, v6}, Landroid/app/Activity;->runOnUiThread(Ljava/lang/Runnable;)V

    int-to-long v4, v3

    invoke-static {v4, v5}, Landroid/os/SystemClock;->sleep(J)V

    new-instance v6, Lcom/nicron/webview/BleScanStopRunnable;

    invoke-direct {v6, p0, v0, v2}, Lcom/nicron/webview/BleScanStopRunnable;-><init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;)V

    invoke-virtual {v7, v6}, Landroid/app/Activity;->runOnUiThread(Ljava/lang/Runnable;)V

    const-wide/16 v4, 0x78

    invoke-static {v4, v5}, Landroid/os/SystemClock;->sleep(J)V

    iget v8, p0, Lcom/nicron/webview/BleObdBridge;->scanCallbackCount:I

    iput v8, p0, Lcom/nicron/webview/BleObdBridge;->scanLowLatencyCallbacks:I

    if-lez v8, :phase_obd_filter

    goto :scan_complete

    :phase_obd_filter
    const/4 v9, 0x0

    iput-object v9, p0, Lcom/nicron/webview/BleObdBridge;->scanError:Ljava/lang/String;

    const-string v4, "3/3 LOW_LATENCY + OBD-nimisuodatin"

    iput-object v4, p0, Lcom/nicron/webview/BleObdBridge;->scanModeUsed:Ljava/lang/String;

    new-instance v6, Lcom/nicron/webview/BleScanStartConfiguredRunnable;

    const/4 v9, 0x1

    invoke-direct {v6, p0, v0, v2, v9}, Lcom/nicron/webview/BleScanStartConfiguredRunnable;-><init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;Z)V

    invoke-virtual {v7, v6}, Landroid/app/Activity;->runOnUiThread(Ljava/lang/Runnable;)V

    int-to-long v4, v3

    invoke-static {v4, v5}, Landroid/os/SystemClock;->sleep(J)V

    new-instance v6, Lcom/nicron/webview/BleScanStopRunnable;

    invoke-direct {v6, p0, v0, v2}, Lcom/nicron/webview/BleScanStopRunnable;-><init>(Lcom/nicron/webview/BleObdBridge;Landroid/bluetooth/le/BluetoothLeScanner;Landroid/bluetooth/le/ScanCallback;)V

    invoke-virtual {v7, v6}, Landroid/app/Activity;->runOnUiThread(Ljava/lang/Runnable;)V

    const-wide/16 v4, 0x78

    invoke-static {v4, v5}, Landroid/os/SystemClock;->sleep(J)V

    iget v8, p0, Lcom/nicron/webview/BleObdBridge;->scanCallbackCount:I

    iput v8, p0, Lcom/nicron/webview/BleObdBridge;->scanObdFilterCallbacks:I

    :scan_complete
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v4

    iput-wide v4, p0, Lcom/nicron/webview/BleObdBridge;->scanStoppedAt:J

    iget-object p1, p0, Lcom/nicron/webview/BleObdBridge;->scanError:Ljava/lang/String;

    if-eqz p1, :build_results

    invoke-virtual {v1}, Ljava/util/concurrent/ConcurrentHashMap;->isEmpty()Z

    move-result v4

    if-eqz v4, :build_results

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :build_results
    new-instance p1, Lorg/json/JSONArray;

    invoke-direct {p1}, Lorg/json/JSONArray;-><init>()V

    invoke-virtual {v1}, Ljava/util/concurrent/ConcurrentHashMap;->values()Ljava/util/Collection;

    move-result-object v0

    invoke-interface {v0}, Ljava/util/Collection;->iterator()Ljava/util/Iterator;

    move-result-object v0

    :result_loop
    invoke-interface {v0}, Ljava/util/Iterator;->hasNext()Z

    move-result v1

    if-eqz v1, :results_done

    invoke-interface {v0}, Ljava/util/Iterator;->next()Ljava/lang/Object;

    move-result-object v1

    invoke-virtual {p1, v1}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;

    goto :result_loop

    :results_done
    invoke-virtual {p1}, Lorg/json/JSONArray;->toString()Ljava/lang/String;

    move-result-object p1
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :scan_exception

    return-object p1

    :scan_exception
    move-exception p1

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->error(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object p1

    return-object p1
.end method

.method public diagnostics()Ljava/lang/String;
    .locals 7
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    new-instance v0, Lorg/json/JSONObject;

    invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V

    const-string v1, "sdk"

    sget v2, Landroid/os/Build$VERSION;->SDK_INT:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    invoke-static {}, Landroid/bluetooth/BluetoothAdapter;->getDefaultAdapter()Landroid/bluetooth/BluetoothAdapter;

    move-result-object v1

    const-string v3, "bluetoothAvailable"

    if-eqz v1, :adapter_missing

    const/4 v4, 0x1

    goto :adapter_value

    :adapter_missing
    const/4 v4, 0x0

    :adapter_value
    invoke-virtual {v0, v3, v4}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    const-string v3, "bluetoothEnabled"

    if-eqz v1, :adapter_disabled

    invoke-virtual {v1}, Landroid/bluetooth/BluetoothAdapter;->isEnabled()Z

    move-result v4

    goto :enabled_value

    :adapter_disabled
    const/4 v4, 0x0

    :enabled_value
    invoke-virtual {v0, v3, v4}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    const/16 v1, 0x1f

    if-lt v2, v1, :legacy_diagnostics

    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->activity:Landroid/app/Activity;

    const-string v3, "android.permission.BLUETOOTH_SCAN"

    invoke-virtual {v1, v3}, Landroid/app/Activity;->checkSelfPermission(Ljava/lang/String;)I

    move-result v1

    const-string v3, "scanPermission"

    if-nez v1, :scan_denied

    const/4 v4, 0x1

    goto :scan_permission_value

    :scan_denied
    const/4 v4, 0x0

    :scan_permission_value
    invoke-virtual {v0, v3, v4}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->activity:Landroid/app/Activity;

    const-string v3, "android.permission.BLUETOOTH_CONNECT"

    invoke-virtual {v1, v3}, Landroid/app/Activity;->checkSelfPermission(Ljava/lang/String;)I

    move-result v1

    const-string v3, "connectPermission"

    if-nez v1, :connect_denied

    const/4 v4, 0x1

    goto :connect_permission_value

    :connect_denied
    const/4 v4, 0x0

    :connect_permission_value
    invoke-virtual {v0, v3, v4}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    goto :diagnostics_ready

    :legacy_diagnostics
    const/16 v1, 0x17

    if-lt v2, v1, :diagnostics_ready

    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->activity:Landroid/app/Activity;

    const-string v2, "android.permission.ACCESS_FINE_LOCATION"

    invoke-virtual {v1, v2}, Landroid/app/Activity;->checkSelfPermission(Ljava/lang/String;)I

    move-result v1

    const-string v2, "locationPermission"

    if-nez v1, :location_denied

    const/4 v4, 0x1

    goto :location_permission_value

    :location_denied
    const/4 v4, 0x0

    :location_permission_value
    invoke-virtual {v0, v2, v4}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    :diagnostics_ready
    const-string v1, "scanApi"

    const-string v2, "3-vaiheinen pääsäiehaku: oletus → LOW_LATENCY → OBD-suodatin"

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "scanModeUsed"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->scanModeUsed:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "scanCallbackCount"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->scanCallbackCount:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    const-string v1, "scanDefaultCallbacks"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->scanDefaultCallbacks:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    const-string v1, "scanLowLatencyCallbacks"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->scanLowLatencyCallbacks:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    const-string v1, "scanObdFilterCallbacks"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->scanObdFilterCallbacks:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    iget-wide v2, p0, Lcom/nicron/webview/BleObdBridge;->scanStartedAt:J

    const-wide/16 v4, 0x0

    cmp-long v6, v2, v4

    if-lez v6, :diagnostics_no_scan_duration

    iget-wide v4, p0, Lcom/nicron/webview/BleObdBridge;->scanStoppedAt:J

    sub-long/2addr v4, v2

    const-string v1, "scanDurationMs"

    invoke-virtual {v0, v1, v4, v5}, Lorg/json/JSONObject;->put(Ljava/lang/String;J)Lorg/json/JSONObject;

    :diagnostics_no_scan_duration
    const-string v1, "gattState"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "lastGattEvent"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->lastGattEvent:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "gattUuids"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->gattUuids:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "transportProfile"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->transportProfile:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "payloadSize"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->payloadSize:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    const-string v1, "writeType"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->writeType:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    const-string v1, "binaryProtocol"

    iget-boolean v2, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    const-string v1, "notificationEnabled"

    iget-boolean v2, p0, Lcom/nicron/webview/BleObdBridge;->notificationEnabled:Z

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    if-eqz v2, :diagnostics_no_write_uuid

    invoke-virtual {v2}, Landroid/bluetooth/BluetoothGattCharacteristic;->getUuid()Ljava/util/UUID;

    move-result-object v2

    invoke-virtual {v2}, Ljava/util/UUID;->toString()Ljava/lang/String;

    move-result-object v2

    const-string v1, "writeUuid"

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    :diagnostics_no_write_uuid
    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->notifyCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    if-eqz v2, :diagnostics_no_notify_uuid

    invoke-virtual {v2}, Landroid/bluetooth/BluetoothGattCharacteristic;->getUuid()Ljava/util/UUID;

    move-result-object v2

    invoke-virtual {v2}, Ljava/util/UUID;->toString()Ljava/lang/String;

    move-result-object v2

    const-string v1, "notifyUuid"

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    :diagnostics_no_notify_uuid
    const-string v1, "cccdValue"

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->cccdValue:Ljava/lang/String;

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "responseChunkCount"

    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->responseChunkCount:I

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->responseChunks:Ljava/lang/StringBuffer;

    if-eqz v2, :diagnostics_no_response_chunks

    invoke-virtual {v2}, Ljava/lang/StringBuffer;->toString()Ljava/lang/String;

    move-result-object v2

    const-string v1, "responseChunksHex"

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    :diagnostics_no_response_chunks
    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->scanError:Ljava/lang/String;

    if-eqz v1, :no_scan_error

    const-string v2, "lastScanError"

    invoke-virtual {v0, v2, v1}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    :no_scan_error
    invoke-virtual {v0}, Lorg/json/JSONObject;->toString()Ljava/lang/String;

    move-result-object v0
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :diagnostics_error

    return-object v0

    :diagnostics_error
    move-exception v0

    invoke-static {v0}, Lcom/nicron/webview/BleObdBridge;->error(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method

.method public declared-synchronized noteScanResult()V
    .locals 1

    iget v0, p0, Lcom/nicron/webview/BleObdBridge;->scanCallbackCount:I

    add-int/lit8 v0, v0, 0x1

    iput v0, p0, Lcom/nicron/webview/BleObdBridge;->scanCallbackCount:I

    return-void
.end method

.method public declared-synchronized send(Ljava/lang/String;I)Ljava/lang/String;
    .locals 12
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    iget v0, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const/4 v1, 0x3

    if-ne v0, v1, :not_connected

    iget-object v0, p0, Lcom/nicron/webview/BleObdBridge;->gatt:Landroid/bluetooth/BluetoothGatt;

    iget-object v1, p0, Lcom/nicron/webview/BleObdBridge;->writeCharacteristic:Landroid/bluetooth/BluetoothGattCharacteristic;

    if-eqz v0, :not_connected

    if-nez v1, :connection_ready

    :not_connected
    const-string p1, "Ei BLE-yhteyttä"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :connection_ready
    new-instance v2, Ljava/lang/StringBuffer;

    invoke-direct {v2}, Ljava/lang/StringBuffer;-><init>()V

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->response:Ljava/lang/StringBuffer;

    new-instance v2, Ljava/lang/StringBuffer;

    invoke-direct {v2}, Ljava/lang/StringBuffer;-><init>()V

    iput-object v2, p0, Lcom/nicron/webview/BleObdBridge;->responseChunks:Ljava/lang/StringBuffer;

    const/4 v2, 0x0

    iput v2, p0, Lcom/nicron/webview/BleObdBridge;->responseChunkCount:I

    iget-boolean v2, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    if-eqz v2, :ascii_command

    invoke-static {p1}, Lcom/nicron/webview/QuicklynksCodec;->hexToBytes(Ljava/lang/String;)[B

    move-result-object p1

    goto :command_bytes_ready

    :ascii_command
    invoke-virtual {p1}, Ljava/lang/String;->trim()Ljava/lang/String;

    move-result-object p1

    invoke-virtual {p1}, Ljava/lang/String;->toUpperCase()Ljava/lang/String;

    move-result-object p1

    const-string v2, "\r"

    invoke-virtual {p1, v2}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    const-string v2, "US-ASCII"

    invoke-virtual {p1, v2}, Ljava/lang/String;->getBytes(Ljava/lang/String;)[B

    move-result-object p1

    :command_bytes_ready
    const/4 v2, 0x0

    array-length v3, p1

    :write_loop
    if-ge v2, v3, :write_done

    iget v4, p0, Lcom/nicron/webview/BleObdBridge;->payloadSize:I

    add-int v5, v2, v4

    if-le v5, v3, :chunk_end_ready

    move v5, v3

    :chunk_end_ready
    invoke-static {p1, v2, v5}, Ljava/util/Arrays;->copyOfRange([BII)[B

    move-result-object v4

    iget v6, p0, Lcom/nicron/webview/BleObdBridge;->writeType:I

    invoke-virtual {v1, v6}, Landroid/bluetooth/BluetoothGattCharacteristic;->setWriteType(I)V

    invoke-virtual {v1, v4}, Landroid/bluetooth/BluetoothGattCharacteristic;->setValue([B)Z

    move-result v4

    if-eqz v4, :write_failed

    invoke-virtual {v0, v1}, Landroid/bluetooth/BluetoothGatt;->writeCharacteristic(Landroid/bluetooth/BluetoothGattCharacteristic;)Z

    move-result v4

    if-nez v4, :write_accepted

    :write_failed
    const-string p1, "BLE-komennon kirjoitus ei käynnistynyt"

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :write_accepted
    const-wide/16 v6, 0x28

    invoke-static {v6, v7}, Landroid/os/SystemClock;->sleep(J)V

    move v2, v5

    goto :write_loop

    :write_done
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v0

    int-to-long v8, p2

    :response_loop
    iget v2, p0, Lcom/nicron/webview/BleObdBridge;->connectionState:I

    const/4 v3, -0x1

    if-ne v2, v3, :read_response

    iget-object p1, p0, Lcom/nicron/webview/BleObdBridge;->connectionError:Ljava/lang/String;

    if-nez p1, :send_error_ready

    const-string p1, "BLE-yhteys katkesi"

    :send_error_ready
    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->errorText(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :read_response
    iget-object v2, p0, Lcom/nicron/webview/BleObdBridge;->response:Ljava/lang/StringBuffer;

    invoke-virtual {v2}, Ljava/lang/StringBuffer;->toString()Ljava/lang/String;

    move-result-object v2

    iget-boolean v3, p0, Lcom/nicron/webview/BleObdBridge;->quicklynksBinary:Z

    if-eqz v3, :ascii_response_check

    invoke-static {v2}, Lcom/nicron/webview/QuicklynksCodec;->hasCompleteFrame(Ljava/lang/String;)Z

    move-result v3

    if-nez v3, :response_ready

    goto :response_incomplete

    :ascii_response_check
    const-string v3, ">"

    invoke-virtual {v2, v3}, Ljava/lang/String;->indexOf(Ljava/lang/String;)I

    move-result v3

    if-gez v3, :response_ready

    :response_incomplete
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v3

    sub-long/2addr v3, v0

    cmp-long v5, v3, v8

    if-ltz v5, :response_wait

    const-string p1, "__TIMEOUT__"

    invoke-virtual {p1, v2}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p1

    return-object p1

    :response_wait
    const-wide/16 v3, 0xf

    invoke-static {v3, v4}, Landroid/os/SystemClock;->sleep(J)V

    goto :response_loop

    :response_ready
    return-object v2
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :send_exception

    :send_exception
    move-exception p1

    invoke-static {p1}, Lcom/nicron/webview/BleObdBridge;->error(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object p1

    return-object p1
.end method

.method public setPayloadSize(I)V
    .locals 0

    iput p1, p0, Lcom/nicron/webview/BleObdBridge;->payloadSize:I

    return-void
.end method

.method public setScanError(Ljava/lang/String;)V
    .locals 0

    iput-object p1, p0, Lcom/nicron/webview/BleObdBridge;->scanError:Ljava/lang/String;

    return-void
.end method
