import test from "node:test";
import assert from "node:assert/strict";
import { milestoneGrantIds, normalizeMilestone, unlockMilestoneOf } from "../domain/location-milestones.ts";

const item = (id, over = {}) => ({ id, level: "information", attributes: { title: id, unlockMilestone: "Der Rundgang" }, canonStatus: "WORKING", content: {}, ...over });

test("a milestone label is trimmed, collapsed and bounded", () => {
  assert.equal(normalizeMilestone("  Der   Rundgang "), "Der Rundgang");
  assert.equal(normalizeMilestone(""), null);
  assert.equal(normalizeMilestone("x".repeat(81)), null);
  assert.equal(normalizeMilestone(42), null);
  assert.equal(unlockMilestoneOf({ unlockMilestone: "  " }), null);
});

test("only information nodes bound to exactly this milestone are granted", () => {
  const items = [item("a"), item("b", { attributes: { title: "b", unlockMilestone: "Anderer Meilenstein" } }), item("c", { attributes: { title: "c" } }), item("d", { level: "area" })];
  assert.deepEqual(milestoneGrantIds(items, "Der Rundgang"), ["a"]);
});

test("secret, SL-only, archived and deleted Erkenntnisse are never granted", () => {
  const items = [
    item("secret", { canonStatus: "GM_SECRET" }),
    item("sl", { attributes: { title: "sl", unlockMilestone: "Der Rundgang", visibility: "gm" } }),
    item("archived", { attributes: { title: "x", unlockMilestone: "Der Rundgang", lifecycle: "archived" } }),
    item("deleted", { attributes: { title: "x", unlockMilestone: "Der Rundgang", lifecycle: "deleted" } }),
    item("recovery", { content: { recoveryOnly: true } }),
    item("ok"),
  ];
  assert.deepEqual(milestoneGrantIds(items, "Der Rundgang"), ["ok"]);
});

test("an empty or invalid label grants nothing", () => {
  assert.deepEqual(milestoneGrantIds([item("a")], "   "), []);
});
