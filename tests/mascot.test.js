import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// mascot.js is a classic browser script; load it in a bare context (no DOM) to reach its pure logic.
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL("../mascot.js", import.meta.url), "utf8"), sandbox);
const { logic } = sandbox.PBMascot;

test("classifyMessage detects worried, happy, friendly, attentive and neutral messages", () => {
  assert.equal(logic.classifyMessage("Our internet is very slow today"), "worried");
  assert.equal(logic.classifyMessage("Hindi gumagana ang POS namin"), "worried");
  assert.equal(logic.classifyMessage("The server is down!"), "worried");
  assert.equal(logic.classifyMessage("Thanks, that was great"), "happy");
  assert.equal(logic.classifyMessage("Salamat po"), "happy");
  assert.equal(logic.classifyMessage("Hello there"), "friendly");
  assert.equal(logic.classifyMessage("Kumusta po"), "friendly");
  assert.equal(logic.classifyMessage("x".repeat(300)), "attentive");
  assert.equal(logic.classifyMessage("I need an inventory system"), "neutral");
  assert.equal(logic.classifyMessage(""), "neutral");
  assert.equal(logic.classifyMessage(null), "neutral");
});

test("classifyMessage does not misfire on partial words", () => {
  assert.equal(logic.classifyMessage("I want to download the report"), "neutral");
  assert.equal(logic.classifyMessage("What is a Slowloris attack?"), "neutral");
});

test("worry takes priority over thanks, and the mascot stays calm after a worried message", () => {
  assert.equal(logic.classifyMessage("Thanks, but the network is broken"), "worried");
  assert.equal(logic.afterResponseState("worried"), "idle");
  assert.equal(logic.afterResponseState("happy"), "success");
  assert.equal(logic.afterResponseState("neutral"), "success");
});

test("every expression the mascot can ask for exists in the sprite", () => {
  const svg = fs.readFileSync(new URL("../assets/mascot-expressions.svg", import.meta.url), "utf8");
  const ids = [...svg.matchAll(/<symbol id="(\w+)"/g)].map((m) => m[1]);
  const wanted = new Set([
    ...Object.values(logic.TYPING_EXPRESSION),
    ...Object.values(logic.SEND_FLASH),
    ...["about", "technology", "services", "process", "contact"].map((id) => logic.sectionReaction(id).expr),
    logic.pickFlair(() => 0, null), logic.pickFlair(() => 0.99, null)
  ]);
  for (const name of wanted) assert.ok(ids.includes(name), `missing symbol: ${name}`);
  assert.deepEqual([...logic.STATES].sort(), [...ids].sort());
});

test("sectionReaction only answers for known sections", () => {
  assert.equal(logic.sectionReaction("services").expr, "responding");
  assert.equal(logic.sectionReaction("top"), null);
  assert.equal(logic.sectionReaction("constructor"), null);
  assert.equal(logic.sectionReaction("__proto__"), null);
});

test("computeLean points toward the target and stays within -1..1", () => {
  const right = logic.computeLean(100, 100, 600, 100);
  assert.ok(right.x > 0.9 && Math.abs(right.y) < 1e-9);
  const upLeft = logic.computeLean(100, 100, 0, 0);
  assert.ok(upLeft.x < 0 && upLeft.y < 0);
  const still = logic.computeLean(50, 50, 50, 50);
  assert.equal(still.x, 0);
  assert.equal(still.y, 0);
  const near = logic.computeLean(100, 100, 110, 100);
  assert.ok(near.x >= 0.35 && near.x <= 1);
});

test("timers stay in sensible ranges and flair never repeats back to back", () => {
  assert.ok(logic.nextBlinkDelay(() => 0) >= 2600 && logic.nextBlinkDelay(() => 0.999) <= 6400);
  assert.ok(logic.nextFlairDelay(() => 0) >= 9000);
  assert.notEqual(logic.pickFlair(() => 0.2, "thinking"), "thinking");
  assert.notEqual(logic.pickFlair(() => 0.8, "responding"), "responding");
});
