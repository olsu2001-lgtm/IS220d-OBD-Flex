.class final Lcom/nicron/webview/ObdBridge$1;
.super Ljava/lang/Object;
.source "ObdBridge.java"

.implements Ljava/lang/Runnable;


# instance fields
.field final synthetic enabled:Z

.field final synthetic this$0:Lcom/nicron/webview/ObdBridge;


# direct methods
.method constructor <init>(Lcom/nicron/webview/ObdBridge;Z)V
    .locals 0

    iput-object p1, p0, Lcom/nicron/webview/ObdBridge$1;->this$0:Lcom/nicron/webview/ObdBridge;

    iput-boolean p2, p0, Lcom/nicron/webview/ObdBridge$1;->enabled:Z

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    return-void
.end method


# virtual methods
.method public run()V
    .locals 2

    iget-object v0, p0, Lcom/nicron/webview/ObdBridge$1;->this$0:Lcom/nicron/webview/ObdBridge;

    invoke-static {v0}, Lcom/nicron/webview/ObdBridge;->access$000(Lcom/nicron/webview/ObdBridge;)Landroid/app/Activity;

    move-result-object v0

    invoke-virtual {v0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;

    move-result-object v0

    const/16 v1, 0x80

    iget-boolean p0, p0, Lcom/nicron/webview/ObdBridge$1;->enabled:Z

    if-eqz p0, :cond_0

    invoke-virtual {v0, v1}, Landroid/view/Window;->addFlags(I)V

    goto :goto_0

    :cond_0
    invoke-virtual {v0, v1}, Landroid/view/Window;->clearFlags(I)V

    :goto_0
    return-void
.end method
