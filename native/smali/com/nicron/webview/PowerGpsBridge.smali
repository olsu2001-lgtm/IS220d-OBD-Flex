.class public final Lcom/nicron/webview/PowerGpsBridge;
.super Ljava/lang/Object;
.source "PowerGpsBridge.java"

.implements Landroid/location/LocationListener;


# instance fields
.field private activity:Landroid/app/Activity;

.field private lastError:Ljava/lang/String;

.field private locationManager:Landroid/location/LocationManager;

.field private running:Z

.field private samples:Lorg/json/JSONArray;

.field private sequence:I


# direct methods
.method public constructor <init>(Landroid/app/Activity;)V
    .locals 2

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/PowerGpsBridge;->activity:Landroid/app/Activity;

    const-string v0, "location"

    invoke-virtual {p1, v0}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/location/LocationManager;

    iput-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->locationManager:Landroid/location/LocationManager;

    new-instance v0, Lorg/json/JSONArray;

    invoke-direct {v0}, Lorg/json/JSONArray;-><init>()V

    iput-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->samples:Lorg/json/JSONArray;

    const-string v0, ""

    iput-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    const/4 v1, 0x0

    iput-boolean v1, p0, Lcom/nicron/webview/PowerGpsBridge;->running:Z

    iput v1, p0, Lcom/nicron/webview/PowerGpsBridge;->sequence:I

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
.method public declared-synchronized drainSamples()Ljava/lang/String;
    .locals 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    iget-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->samples:Lorg/json/JSONArray;

    invoke-virtual {v0}, Lorg/json/JSONArray;->toString()Ljava/lang/String;

    move-result-object v0

    new-instance v1, Lorg/json/JSONArray;

    invoke-direct {v1}, Lorg/json/JSONArray;-><init>()V

    iput-object v1, p0, Lcom/nicron/webview/PowerGpsBridge;->samples:Lorg/json/JSONArray;

    return-object v0
.end method

.method public declared-synchronized getLastError()Ljava/lang/String;
    .locals 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    iget-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    const-string v1, ""

    iput-object v1, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    return-object v0
.end method

.method public onLocationChanged(Landroid/location/Location;)V
    .locals 6

    :try_start_0
    new-instance v0, Lorg/json/JSONObject;

    invoke-direct {v0}, Lorg/json/JSONObject;-><init>()V

    const-string v1, "elapsedRealtimeNanos"

    invoke-virtual {p1}, Landroid/location/Location;->getElapsedRealtimeNanos()J

    move-result-wide v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;J)Lorg/json/JSONObject;

    const-string v1, "timestampMs"

    invoke-virtual {p1}, Landroid/location/Location;->getTime()J

    move-result-wide v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;J)Lorg/json/JSONObject;

    const-string v1, "provider"

    invoke-virtual {p1}, Landroid/location/Location;->getProvider()Ljava/lang/String;

    move-result-object v2

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    const-string v1, "horizontalAccuracyM"

    invoke-virtual {p1}, Landroid/location/Location;->getAccuracy()F

    move-result v2

    float-to-double v2, v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    invoke-virtual {p1}, Landroid/location/Location;->hasSpeed()Z

    move-result v1

    if-eqz v1, :no_speed

    const-string v1, "speedMps"

    invoke-virtual {p1}, Landroid/location/Location;->getSpeed()F

    move-result v2

    float-to-double v2, v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    const-string v1, "speedAvailable"

    const/4 v2, 0x1

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    goto :speed_done

    :no_speed
    const-string v1, "speedMps"

    const-wide/16 v2, 0x0

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    const-string v1, "speedAvailable"

    const/4 v2, 0x0

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    :speed_done
    invoke-virtual {p1}, Landroid/location/Location;->hasAltitude()Z

    move-result v1

    if-eqz v1, :no_altitude

    const-string v1, "altitudeM"

    invoke-virtual {p1}, Landroid/location/Location;->getAltitude()D

    move-result-wide v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    :no_altitude
    invoke-virtual {p1}, Landroid/location/Location;->hasBearing()Z

    move-result v1

    if-eqz v1, :no_bearing

    const-string v1, "bearingDeg"

    invoke-virtual {p1}, Landroid/location/Location;->getBearing()F

    move-result v2

    float-to-double v2, v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    :no_bearing
    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v2, 0x1a

    if-lt v1, v2, :accuracy_done

    invoke-virtual {p1}, Landroid/location/Location;->hasSpeedAccuracy()Z

    move-result v1

    if-eqz v1, :no_speed_accuracy

    const-string v1, "speedAccuracyMps"

    invoke-virtual {p1}, Landroid/location/Location;->getSpeedAccuracyMetersPerSecond()F

    move-result v2

    float-to-double v2, v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    :no_speed_accuracy
    invoke-virtual {p1}, Landroid/location/Location;->hasVerticalAccuracy()Z

    move-result v1

    if-eqz v1, :no_vertical_accuracy

    const-string v1, "verticalAccuracyM"

    invoke-virtual {p1}, Landroid/location/Location;->getVerticalAccuracyMeters()F

    move-result v2

    float-to-double v2, v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    :no_vertical_accuracy
    invoke-virtual {p1}, Landroid/location/Location;->hasBearingAccuracy()Z

    move-result v1

    if-eqz v1, :accuracy_done

    const-string v1, "bearingAccuracyDeg"

    invoke-virtual {p1}, Landroid/location/Location;->getBearingAccuracyDegrees()F

    move-result v2

    float-to-double v2, v2

    invoke-virtual {v0, v1, v2, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;D)Lorg/json/JSONObject;

    :accuracy_done
    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v2, 0x12

    if-lt v1, v2, :mock_done

    const-string v1, "mock"

    invoke-virtual {p1}, Landroid/location/Location;->isFromMockProvider()Z

    move-result v2

    invoke-virtual {v0, v1, v2}, Lorg/json/JSONObject;->put(Ljava/lang/String;Z)Lorg/json/JSONObject;

    :mock_done
    iget v1, p0, Lcom/nicron/webview/PowerGpsBridge;->sequence:I

    add-int/lit8 v1, v1, 0x1

    iput v1, p0, Lcom/nicron/webview/PowerGpsBridge;->sequence:I

    const-string v2, "sequence"

    invoke-virtual {v0, v2, v1}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    monitor-enter p0
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_outer

    :try_start_1
    iget-object v1, p0, Lcom/nicron/webview/PowerGpsBridge;->samples:Lorg/json/JSONArray;

    invoke-virtual {v1, v0}, Lorg/json/JSONArray;->put(Ljava/lang/Object;)Lorg/json/JSONArray;

    invoke-virtual {v1}, Lorg/json/JSONArray;->length()I

    move-result v0

    const/16 v2, 0x200

    if-le v0, v2, :queue_ok

    const/4 v0, 0x0

    invoke-virtual {v1, v0}, Lorg/json/JSONArray;->remove(I)Ljava/lang/Object;

    :queue_ok
    monitor-exit p0
    :try_end_1
    .catchall {:try_start_1 .. :try_end_1} :catchall_0
    .catch Ljava/lang/Exception; {:try_start_1 .. :try_end_1} :catch_outer

    return-void

    :catchall_0
    move-exception p1

    monitor-exit p0

    throw p1

    :catch_outer
    move-exception p1

    invoke-virtual {p1}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object p1

    if-nez p1, :store_error

    const-string p1, "GPS-näytteen käsittely epäonnistui"

    :store_error
    iput-object p1, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    return-void
.end method

.method public onProviderDisabled(Ljava/lang/String;)V
    .locals 0

    const-string p1, "Puhelimen GPS-paikannus poistettiin käytöstä"

    iput-object p1, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    return-void
.end method

.method public onProviderEnabled(Ljava/lang/String;)V
    .locals 1

    const-string v0, ""

    iput-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    return-void
.end method

.method public onStatusChanged(Ljava/lang/String;ILandroid/os/Bundle;)V
    .locals 0

    return-void
.end method

.method public declared-synchronized start()Ljava/lang/String;
    .locals 7
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    iget-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->locationManager:Landroid/location/LocationManager;

    if-nez v0, :manager_ok

    const-string v0, "__ERROR__Puhelimen paikannuspalvelua ei ole"

    return-object v0

    :manager_ok
    iget-object v1, p0, Lcom/nicron/webview/PowerGpsBridge;->activity:Landroid/app/Activity;

    const-string v2, "android.permission.ACCESS_FINE_LOCATION"

    invoke-virtual {v1, v2}, Landroid/app/Activity;->checkCallingOrSelfPermission(Ljava/lang/String;)I

    move-result v1

    if-eqz v1, :permission_ok

    const-string v0, "__ERROR__Salli sovellukselle tarkka sijainti Androidin oikeusikkunasta"

    return-object v0

    :permission_ok
    const-string v1, "gps"

    invoke-virtual {v0, v1}, Landroid/location/LocationManager;->isProviderEnabled(Ljava/lang/String;)Z

    move-result v2

    if-nez v2, :provider_ok

    const-string v0, "__ERROR__Ota puhelimen GPS-paikannus käyttöön"

    return-object v0

    :provider_ok
    invoke-virtual {p0}, Lcom/nicron/webview/PowerGpsBridge;->stop()V

    new-instance v2, Lorg/json/JSONArray;

    invoke-direct {v2}, Lorg/json/JSONArray;-><init>()V

    iput-object v2, p0, Lcom/nicron/webview/PowerGpsBridge;->samples:Lorg/json/JSONArray;

    const-string v2, ""

    iput-object v2, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    const/4 v2, 0x0

    iput v2, p0, Lcom/nicron/webview/PowerGpsBridge;->sequence:I

    const-wide/16 v2, 0x0

    const/4 v4, 0x0

    move-object v5, p0

    invoke-static {}, Landroid/os/Looper;->getMainLooper()Landroid/os/Looper;

    move-result-object v6

    invoke-virtual/range {v0 .. v6}, Landroid/location/LocationManager;->requestLocationUpdates(Ljava/lang/String;JFLandroid/location/LocationListener;Landroid/os/Looper;)V

    const/4 v0, 0x1

    iput-boolean v0, p0, Lcom/nicron/webview/PowerGpsBridge;->running:Z

    const-string v0, "OK"
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    return-object v0

    :catch_0
    move-exception v0

    const/4 v1, 0x0

    iput-boolean v1, p0, Lcom/nicron/webview/PowerGpsBridge;->running:Z

    invoke-static {v0}, Lcom/nicron/webview/PowerGpsBridge;->error(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object v0

    return-object v0
.end method

.method public declared-synchronized stop()V
    .locals 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    iget-object v0, p0, Lcom/nicron/webview/PowerGpsBridge;->locationManager:Landroid/location/LocationManager;

    if-eqz v0, :stop_done

    invoke-virtual {v0, p0}, Landroid/location/LocationManager;->removeUpdates(Landroid/location/LocationListener;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    goto :stop_done

    :catch_0
    move-exception v0

    invoke-virtual {v0}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object v1

    iput-object v1, p0, Lcom/nicron/webview/PowerGpsBridge;->lastError:Ljava/lang/String;

    :stop_done
    const/4 v0, 0x0

    iput-boolean v0, p0, Lcom/nicron/webview/PowerGpsBridge;->running:Z

    return-void
.end method
