.class final Lcom/nicron/webview/BleGattCallback;
.super Landroid/bluetooth/BluetoothGattCallback;
.source "BleGattCallback.java"


# instance fields
.field private final bridge:Lcom/nicron/webview/BleObdBridge;


# direct methods
.method constructor <init>(Lcom/nicron/webview/BleObdBridge;)V
    .locals 0

    invoke-direct {p0}, Landroid/bluetooth/BluetoothGattCallback;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    return-void
.end method

.method private statusError(Ljava/lang/String;I)Ljava/lang/String;
    .locals 1

    new-instance v0, Ljava/lang/StringBuilder;

    invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V

    invoke-virtual {v0, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    const-string p1, " (GATT "

    invoke-virtual {v0, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v0, p2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    const-string p1, ")"

    invoke-virtual {v0, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p1

    return-object p1
.end method


# virtual methods
.method public onCharacteristicChanged(Landroid/bluetooth/BluetoothGatt;Landroid/bluetooth/BluetoothGattCharacteristic;)V
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v0, p1}, Lcom/nicron/webview/BleObdBridge;->ownsGatt(Landroid/bluetooth/BluetoothGatt;)Z

    move-result v0

    if-eqz v0, :done

    invoke-virtual {p2}, Landroid/bluetooth/BluetoothGattCharacteristic;->getValue()[B

    move-result-object p1

    if-eqz p1, :done

    iget-object p2, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, p1}, Lcom/nicron/webview/BleObdBridge;->appendResponse([B)V

    :done
    return-void
.end method

.method public onCharacteristicChanged(Landroid/bluetooth/BluetoothGatt;Landroid/bluetooth/BluetoothGattCharacteristic;[B)V
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v0, p1}, Lcom/nicron/webview/BleObdBridge;->ownsGatt(Landroid/bluetooth/BluetoothGatt;)Z

    move-result v0

    if-eqz v0, :done

    if-eqz p3, :done

    iget-object p1, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p1, p3}, Lcom/nicron/webview/BleObdBridge;->appendResponse([B)V

    :done
    return-void
.end method

.method public onCharacteristicWrite(Landroid/bluetooth/BluetoothGatt;Landroid/bluetooth/BluetoothGattCharacteristic;I)V
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v0, p1}, Lcom/nicron/webview/BleObdBridge;->ownsGatt(Landroid/bluetooth/BluetoothGatt;)Z

    move-result v0

    if-eqz v0, :done

    if-eqz p3, :done

    const-string p1, "BLE-kirjoitus epäonnistui"

    invoke-direct {p0, p1, p3}, Lcom/nicron/webview/BleGattCallback;->statusError(Ljava/lang/String;I)Ljava/lang/String;

    move-result-object p1

    iget-object p2, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    :done
    return-void
.end method

.method public onConnectionStateChange(Landroid/bluetooth/BluetoothGatt;II)V
    .locals 2

    move-object v0, p1

    iget-object v1, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v1, v0}, Lcom/nicron/webview/BleObdBridge;->ownsGatt(Landroid/bluetooth/BluetoothGatt;)Z

    move-result v1

    if-eqz v1, :done

    if-eqz p2, :status_ok

    const-string p1, "BLE-yhteys epäonnistui"

    invoke-direct {p0, p1, p2}, Lcom/nicron/webview/BleGattCallback;->statusError(Ljava/lang/String;I)Ljava/lang/String;

    move-result-object p1

    iget-object p2, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void

    :status_ok
    const/4 p2, 0x2

    if-ne p3, p2, :check_disconnected

    iget-object p2, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, v0}, Lcom/nicron/webview/BleObdBridge;->handleConnected(Landroid/bluetooth/BluetoothGatt;)V

    return-void

    :check_disconnected
    if-nez p3, :done

    iget-object p1, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p1, v0}, Lcom/nicron/webview/BleObdBridge;->handleDisconnected(Landroid/bluetooth/BluetoothGatt;)V

    :done
    return-void
.end method

.method public onDescriptorWrite(Landroid/bluetooth/BluetoothGatt;Landroid/bluetooth/BluetoothGattDescriptor;I)V
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v0, p1}, Lcom/nicron/webview/BleObdBridge;->ownsGatt(Landroid/bluetooth/BluetoothGatt;)Z

    move-result v0

    if-eqz v0, :done

    if-eqz p3, :ready

    const-string p1, "BLE-ilmoitusten käyttöönotto epäonnistui"

    invoke-direct {p0, p1, p3}, Lcom/nicron/webview/BleGattCallback;->statusError(Ljava/lang/String;I)Ljava/lang/String;

    move-result-object p1

    iget-object p2, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void

    :ready
    iget-object p1, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p1}, Lcom/nicron/webview/BleObdBridge;->markReady()V

    :done
    return-void
.end method

.method public onMtuChanged(Landroid/bluetooth/BluetoothGatt;II)V
    .locals 0

    if-eqz p3, :status_ok

    return-void

    :status_ok
    add-int/lit8 p2, p2, -0x3

    const/16 p1, 0x14

    if-ge p2, p1, :size_ok

    move p2, p1

    :size_ok
    iget-object p1, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p1, p2}, Lcom/nicron/webview/BleObdBridge;->setPayloadSize(I)V

    return-void
.end method

.method public onServicesDiscovered(Landroid/bluetooth/BluetoothGatt;I)V
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {v0, p1}, Lcom/nicron/webview/BleObdBridge;->ownsGatt(Landroid/bluetooth/BluetoothGatt;)Z

    move-result v0

    if-eqz v0, :done

    if-eqz p2, :configure

    const-string p1, "BLE-palveluiden tunnistus epäonnistui"

    invoke-direct {p0, p1, p2}, Lcom/nicron/webview/BleGattCallback;->statusError(Ljava/lang/String;I)Ljava/lang/String;

    move-result-object p1

    iget-object p2, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, p1}, Lcom/nicron/webview/BleObdBridge;->fail(Ljava/lang/String;)V

    return-void

    :configure
    iget-object p2, p0, Lcom/nicron/webview/BleGattCallback;->bridge:Lcom/nicron/webview/BleObdBridge;

    invoke-virtual {p2, p1}, Lcom/nicron/webview/BleObdBridge;->configureGatt(Landroid/bluetooth/BluetoothGatt;)V

    :done
    return-void
.end method
