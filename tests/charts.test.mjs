import test from "node:test";
import assert from "node:assert/strict";
import { drawLineChart } from "../src/charts.js";

function fakeCanvas() {
  const context = {
    setTransform() {}, clearRect() {}, fillRect() {}, fillText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}
  };
  return {
    width: 0,
    height: 0,
    style: {},
    clientWidth: 320,
    getAttribute(name) { return name === "height" ? String(this.height || "") : ""; },
    getBoundingClientRect() { return { width: 320 }; },
    getContext() { return context; }
  };
}

test("livekaavion korkeus ei kasva DPR-kertoimella jokaisella piirrolla", () => {
  const previous = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 2;
  try {
    const canvas = fakeCanvas();
    const points = [{ time: 0, value: 1 }, { time: 1000, value: 2 }];
    drawLineChart(canvas, points);
    assert.equal(canvas.height, 420);
    assert.equal(canvas.style.height, "210px");
    drawLineChart(canvas, points);
    assert.equal(canvas.height, 420);
    assert.equal(canvas.style.height, "210px");
  } finally {
    globalThis.devicePixelRatio = previous;
  }
});
