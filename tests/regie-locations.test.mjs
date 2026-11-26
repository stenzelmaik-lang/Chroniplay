import test from "node:test";
import assert from "node:assert/strict";
import { sceneLocationsFrom } from "../domain/regie-locations.ts";

const row = (id, over = {}) => ({ entity_id: id, location_id: "place.x", level: "area", revision: 3, world_state: "active", attributes: JSON.stringify({ title: "Bereich " + id }), title: "DB " + id, ...over });

test("keeps the order of the scene and marks the main place", () => {
  const rows = [row("a"), row("b", { level: "location" })];
  const out = sceneLocationsFrom(rows, ["b", "a"], new Set(["b"]));
  assert.deepEqual(out.map(x => [x.id, x.main, x.title, x.revision, x.worldState]), [["b", true, "Bereich b", 3, "active"], ["a", false, "Bereich a", 3, "active"]]);
});

test("archived and deleted places are not offered in the Regie", () => {
  const rows = [row("a", { attributes: JSON.stringify({ title: "Alt", lifecycle: "archived" }) }), row("b", { attributes: JSON.stringify({ title: "Weg", lifecycle: "deleted" }) }), row("c")];
  assert.deepEqual(sceneLocationsFrom(rows, ["a", "b", "c"], new Set()).map(x => x.id), ["c"]);
});

test("unknown ids are skipped; broken attributes fall back to the entity title", () => {
  const rows = [row("a", { attributes: "{broken", title: "Titel aus DB" })];
  const out = sceneLocationsFrom(rows, ["missing", "a"], new Set());
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Titel aus DB");
});
