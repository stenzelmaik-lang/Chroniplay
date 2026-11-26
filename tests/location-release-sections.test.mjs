import test from "node:test";
import assert from "node:assert/strict";
import { playerSeenIds, sectionAction, sectionActionText, sectionState } from "../domain/location-release-sections.ts";
import { locationPublicKey } from "../domain/location-public-key.ts";

const row = (over = {}) => ({ entityId: "x", version: 1, transition: "publish", lastPublishedRevisionId: "r1", discoveryState: "known", discoveryVersion: 1, secret: false, approvedRevisionId: "r1", ...over });
const untouched = (over = {}) => row({ version: 0, transition: "none", lastPublishedRevisionId: null, approvedRevisionId: null, ...over });

test("SL-only and secret sections never offer an action", () => {
  assert.equal(sectionState({ visibility: "gm" }, row(), true), "sl");
  assert.equal(sectionState({}, row({ secret: true }), true), "sl");
  assert.equal(sectionAction("sl", row()), null);
});

test("released sections the players see can be hidden; a newer approved text is offered first", () => {
  assert.equal(sectionState({}, row(), true), "visible");
  assert.equal(sectionAction("visible", row()), "revoke");
  const newer = row({ approvedRevisionId: "r2" });
  assert.equal(sectionState({}, newer, true), "newer");
  assert.equal(sectionActionText("newer", sectionAction("newer", newer)), "Neue Fassung freischalten");
});

test("a never handled section the players see is reported as Grundfassung, not as hidden", () => {
  assert.equal(sectionState({}, untouched(), true), "base");
  assert.equal(sectionAction("base", untouched()), "revoke");
  assert.equal(sectionAction("base", untouched({ approvedRevisionId: "r9" })), "publish");
});

test("unseen sections: undiscovered, ready, blocked or still a draft", () => {
  assert.equal(sectionState({}, row({ discoveryState: "hidden" }), false), "undiscovered");
  assert.equal(sectionState({}, untouched({ discoveryState: "hidden" }), false), "undiscovered");
  assert.equal(sectionAction("undiscovered", row()), "discover");
  assert.equal(sectionState({}, row({ transition: "revoke" }), false), "ready");
  assert.equal(sectionState({}, row({ transition: "block", approvedRevisionId: null }), false), "blocked");
  assert.equal(sectionActionText("blocked", sectionAction("blocked", row())), "Sperre aufheben");
  assert.equal(sectionState({}, row({ transition: "revoke", approvedRevisionId: null }), false), "draft");
  assert.equal(sectionState({}, undefined, false), "draft");
  assert.equal(sectionAction("draft", undefined), "finish");
});

test("player projection is matched by dossier key; redacted placeholder areas never count", () => {
  const href = id => "/spielbereich?bereich=schauplaetze&ort=p&eintrag=" + locationPublicKey(id);
  const projection = { location: { id: "p", areas: [
    { viewKey: "x1", redacted: false, dossierHref: href("area.a"), rooms: [{ viewKey: "x2", dossierHref: href("room.r") }] },
    { viewKey: "x3", redacted: true, dossierHref: href("area.secret"), rooms: [] },
  ], knownInformation: [{ id: "masked", dossierHref: href("info.i") }] } };
  assert.deepEqual([...playerSeenIds(projection, ["p", "area.a", "room.r", "info.i", "area.secret", "room.other"])].sort(), ["area.a", "info.i", "p", "room.r"]);
  assert.equal(playerSeenIds(null, ["p"]).size, 0);
});