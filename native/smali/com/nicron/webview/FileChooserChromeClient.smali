.class public Lcom/nicron/webview/FileChooserChromeClient;
.super Landroid/webkit/WebChromeClient;
.source "FileChooserChromeClient.java"


# instance fields
.field private final activity:Lcom/nicron/webview/MainActivity;


# direct methods
.method public constructor <init>(Lcom/nicron/webview/MainActivity;)V
    .locals 0

    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/FileChooserChromeClient;->activity:Lcom/nicron/webview/MainActivity;

    return-void
.end method


# virtual methods
.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 1

    iget-object v0, p0, Lcom/nicron/webview/FileChooserChromeClient;->activity:Lcom/nicron/webview/MainActivity;

    invoke-virtual {v0, p2, p3}, Lcom/nicron/webview/MainActivity;->openFileChooser(Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z

    move-result v0

    return v0
.end method
