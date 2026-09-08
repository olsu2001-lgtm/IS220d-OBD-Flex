.class final Lcom/nicron/webview/QuicklynksCodec;
.super Ljava/lang/Object;
.source "QuicklynksCodec.java"


# direct methods
.method static bytesToHex([B)Ljava/lang/String;
    .locals 8

    if-nez p0, :bytes_present

    const-string p0, ""

    return-object p0

    :bytes_present
    new-instance v0, Ljava/lang/StringBuilder;

    array-length v1, p0

    mul-int/lit8 v1, v1, 0x2

    invoke-direct {v0, v1}, Ljava/lang/StringBuilder;-><init>(I)V

    const-string v1, "0123456789ABCDEF"

    const/4 v2, 0x0

    array-length v3, p0

    :hex_loop
    if-ge v2, v3, :hex_done

    aget-byte v4, p0, v2

    and-int/lit16 v4, v4, 0xff

    shr-int/lit8 v5, v4, 0x4

    invoke-virtual {v1, v5}, Ljava/lang/String;->charAt(I)C

    move-result v5

    invoke-virtual {v0, v5}, Ljava/lang/StringBuilder;->append(C)Ljava/lang/StringBuilder;

    and-int/lit8 v4, v4, 0xf

    invoke-virtual {v1, v4}, Ljava/lang/String;->charAt(I)C

    move-result v4

    invoke-virtual {v0, v4}, Ljava/lang/StringBuilder;->append(C)Ljava/lang/StringBuilder;

    add-int/lit8 v2, v2, 0x1

    goto :hex_loop

    :hex_done
    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p0

    return-object p0
.end method

.method static hasCompleteFrame(Ljava/lang/String;)Z
    .locals 4

    if-eqz p0, :incomplete

    invoke-virtual {p0}, Ljava/lang/String;->length()I

    move-result v0

    const/4 v1, 0x2

    if-lt v0, v1, :incomplete

    :try_start_0
    const/4 v2, 0x0

    invoke-virtual {p0, v2, v1}, Ljava/lang/String;->substring(II)Ljava/lang/String;

    move-result-object v2

    const/16 v3, 0x10

    invoke-static {v2, v3}, Ljava/lang/Integer;->parseInt(Ljava/lang/String;I)I

    move-result v2

    add-int/lit8 v2, v2, 0x1

    mul-int/lit8 v2, v2, 0x2
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :incomplete

    if-lt v0, v2, :incomplete

    const/4 p0, 0x1

    return p0

    :incomplete
    const/4 p0, 0x0

    return p0
.end method

.method static hexToBytes(Ljava/lang/String;)[B
    .locals 8

    if-eqz p0, :invalid

    const-string v0, "\\s+"

    const-string v1, ""

    invoke-virtual {p0, v0, v1}, Ljava/lang/String;->replaceAll(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object p0

    invoke-virtual {p0}, Ljava/lang/String;->toUpperCase()Ljava/lang/String;

    move-result-object p0

    invoke-virtual {p0}, Ljava/lang/String;->length()I

    move-result v0

    if-eqz v0, :invalid

    rem-int/lit8 v1, v0, 0x2

    if-nez v1, :invalid

    div-int/lit8 v1, v0, 0x2

    new-array v1, v1, [B

    const/4 v2, 0x0

    const/4 v3, 0x0

    :parse_loop
    if-ge v2, v0, :parse_done

    add-int/lit8 v4, v2, 0x2

    :try_start_0
    invoke-virtual {p0, v2, v4}, Ljava/lang/String;->substring(II)Ljava/lang/String;

    move-result-object v5

    const/16 v6, 0x10

    invoke-static {v5, v6}, Ljava/lang/Integer;->parseInt(Ljava/lang/String;I)I

    move-result v5

    int-to-byte v5, v5

    aput-byte v5, v1, v3
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :invalid

    move v2, v4

    add-int/lit8 v3, v3, 0x1

    goto :parse_loop

    :parse_done
    return-object v1

    :invalid
    new-instance p0, Ljava/lang/IllegalArgumentException;

    const-string v0, "Virheellinen Quicklynks HEX -komento"

    invoke-direct {p0, v0}, Ljava/lang/IllegalArgumentException;-><init>(Ljava/lang/String;)V

    throw p0
.end method
