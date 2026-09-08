export function drawLineChart(canvas, points, options = {}) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(260, Math.round(rect.width || canvas.clientWidth || 320));
  const height = Number(canvas.getAttribute("height")) || 210;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = options.background || "#0d131a";
  ctx.fillRect(0, 0, width, height);

  const values = (points || []).filter(point => Number.isFinite(point.value));
  if (values.length < 2) {
    ctx.fillStyle = "#667587";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Kuvaaja ilmestyy, kun arvoja on vähintään kaksi", width / 2, height / 2);
    return;
  }

  const padding = { left: 48, right: 12, top: 18, bottom: 28 };
  let min = Math.min(...values.map(point => point.value));
  let max = Math.max(...values.map(point => point.value));
  if (min === max) { min -= 1; max += 1; }
  const margin = (max - min) * .08;
  min -= margin;
  max += margin;
  const minTime = Math.min(...values.map(point => point.time));
  const maxTime = Math.max(...values.map(point => point.time));
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  ctx.strokeStyle = "#24303d";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#718196";
  ctx.font = "10px system-ui";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + plotHeight * i / 4;
    const label = max - (max - min) * i / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatAxis(label), padding.left - 7, y + 3);
  }

  ctx.beginPath();
  values.forEach((point, index) => {
    const x = padding.left + (point.time - minTime) / Math.max(1, maxTime - minTime) * plotWidth;
    const y = padding.top + (max - point.value) / (max - min) * plotHeight;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = options.color || "#58d68d";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  if (options.markers?.length) {
    ctx.strokeStyle = "#ffcc66";
    ctx.fillStyle = "#ffcc66";
    ctx.textAlign = "center";
    for (const marker of options.markers) {
      const x = padding.left + (marker.time - minTime) / Math.max(1, maxTime - minTime) * plotWidth;
      if (x < padding.left || x > width - padding.right) continue;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();
      ctx.fillText("●", x, padding.top - 5);
    }
  }

  ctx.fillStyle = "#718196";
  ctx.textAlign = "left";
  ctx.fillText(formatDuration(maxTime - minTime), padding.left, height - 8);
  ctx.textAlign = "right";
  ctx.fillText(options.unit || "", width - padding.right, height - 8);
}

function formatAxis(value) {
  const abs = Math.abs(value);
  if (abs >= 10000) return `${(value / 1000).toFixed(0)}k`;
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
