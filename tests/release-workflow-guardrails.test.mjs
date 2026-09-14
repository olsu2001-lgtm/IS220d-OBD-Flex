import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

function count(text, needle) {
  return text.split(needle).length - 1;
}

test("ordinary source pull requests do not imply APK publication", () => {
  assert.match(workflow, /startsWith\(github\.head_ref, 'release\/'\)/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.publish/);
  assert.match(workflow, /FLEX_PUBLISH:/);
  assert.ok(
    count(workflow, "if: env.FLEX_PUBLISH == 'true'") >= 5,
    "all release-only steps must remain gated behind explicit publication intent"
  );
});

test("regression tests run before any release-only step", () => {
  const testStep = workflow.indexOf("- name: Run regression and safety tests");
  const releaseCheck = workflow.indexOf("- name: Check shared release registry");
  assert.ok(testStep >= 0, "regression test step must exist");
  assert.ok(releaseCheck > testStep, "release work must happen only after source tests");
  const between = workflow.slice(testStep, releaseCheck);
  assert.doesNotMatch(between, /FLEX_PUBLISH == 'true'/, "source tests themselves must not require publication intent");
});

test("release workflow remains fail-closed through registry check and registration", () => {
  assert.match(workflow, /run: npm run release:check/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /run: npm run release:register/);
  assert.ok(
    workflow.indexOf("run: npm run release:check") < workflow.indexOf("run: npm run build"),
    "registry check must precede build"
  );
  assert.ok(
    workflow.indexOf("run: npm run build") < workflow.indexOf("run: npm run release:register"),
    "verified build must precede immutable registration"
  );
});
