.class final Lcom/nicron/webview/ShareCsvRunnable;
.super Ljava/lang/Object;
.source "ShareCsvRunnable.java"

# interfaces
.implements Ljava/lang/Runnable;

# instance fields
.field private final activity:Landroid/app/Activity;

.field private final intent:Landroid/content/Intent;

# direct methods
.method public constructor <init>(Landroid/app/Activity;Landroid/content/Intent;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/nicron/webview/ShareCsvRunnable;->activity:Landroid/app/Activity;

    iput-object p2, p0, Lcom/nicron/webview/ShareCsvRunnable;->intent:Landroid/content/Intent;

    return-void
.end method

# virtual methods
.method public run()V
    .locals 2

    iget-object v0, p0, Lcom/nicron/webview/ShareCsvRunnable;->activity:Landroid/app/Activity;

    iget-object v1, p0, Lcom/nicron/webview/ShareCsvRunnable;->intent:Landroid/content/Intent;

    invoke-virtual {v0, v1}, Landroid/app/Activity;->startActivity(Landroid/content/Intent;)V

    return-void
.end method
