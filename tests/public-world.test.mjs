import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isMarkedForWebsite, publicChronicleEntry, publicPerson, publicPlace, publicRichText, publicStaticImage, publicTeaser,
  sortPublicChronicle, websiteFlagKeys,
} from "../domain/public-world.ts";
import { encodeRichText, readRichText } from "../domain/location-rich-text.ts";
import { npcProfileSchema, npcFieldNames } from "../domain/npc-profile.ts";

const rich = blocks => encodeRichText({ version: 1, blocks });

test("only an explicit boolean true marks an entry for the website", () => {
  assert.equal(isMarkedForWebsite({ showOnWebsite: true }, websiteFlagKeys.place), true);
  for (const value of ["true", 1, "1", false, null, undefined, {}]) assert.equal(isMarkedForWebsite({ showOnWebsite: value }, "showOnWebsite"), false);
  assert.equal(isMarkedForWebsite(null, "showOnWebsite"), false);
  assert.equal(isMarkedForWebsite([true], "0"), false);
  // "public" in the location model means "known in the game"; it never counts as a website release.
  assert.equal(isMarkedForWebsite({ visibility: "public" }, websiteFlagKeys.place), false);
  assert.notEqual(websiteFlagKeys.place, "public");
});

test("only bundled static images are emitted; uploads need a login", () => {
  assert.equal(publicStaticImage("/images/kleve.png"), "/images/kleve.png");
  for (const value of ["/api/files?id=abc", "/api/cms/media?id=1&entityId=2", "/api/locations/media?id=3", "https://example.invalid/a.png", "/images/../secret.png", "/images/a b.png", 7, null])
    assert.equal(publicStaticImage(value), "", String(value));
});

test("public rich text drops images (also nested) and internal links, keeps external links and text", () => {
  const value = rich([
    { type: "paragraph", children: [{ text: "Vor dem Tor " }, { text: "intern", href: "/spielbereich?bereich=schauplaetze&ort=place.x&eintrag=room.secret" }, { text: " und " }, { text: "extern", href: "https://example.invalid/kleve" }] },
    { type: "image", fileId: "file-SECRET-1", alt: "Plan" },
    { type: "details", summary: "Mehr", content: { version: 1, blocks: [{ type: "image", fileId: "file-SECRET-2", alt: "" }, { type: "paragraph", children: [{ text: "Innen" }] }] } },
    { type: "details", summary: "Nur Bild", content: { version: 1, blocks: [{ type: "image", fileId: "file-SECRET-3", alt: "" }] } },
  ]);
  const out = publicRichText(value);
  assert.ok(out.startsWith("cvk-rich-v1:"));
  for (const secret of ["file-SECRET-1", "file-SECRET-2", "file-SECRET-3", "/spielbereich", "room.secret"]) assert.ok(!out.includes(secret), secret);
  const blocks = readRichText(out).blocks;
  assert.equal(blocks.length, 2, "image and image-only details block are removed");
  assert.deepEqual(blocks[0].children.map(part => part.text).join(""), "Vor dem Tor intern und extern");
  assert.equal(blocks[0].children[3].href, "https://example.invalid/kleve");
  assert.equal(blocks[0].children[1].href, undefined);
  assert.equal(publicRichText(rich([{ type: "image", fileId: "x", alt: "" }])), "", "an image-only text is empty");
  assert.equal(publicRichText(""), "");
  assert.equal(publicRichText(42), "");
  assert.ok(publicRichText("Schlichter alter Text").includes("Schlichter alter Text"), "legacy plain text stays readable");
});

test("teasers are plain and bounded", () => {
  const value = rich([{ type: "paragraph", children: [{ text: "Eins zwei drei vier fünf sechs" }] }]);
  assert.equal(publicTeaser(value, 100), "Eins zwei drei vier fünf sechs");
  assert.equal(publicTeaser(value, 12), "Eins zwei …");
  assert.equal(publicTeaser(undefined), "");
});

test("a place shows only allowlisted root fields of a group-known place", () => {
  const projected = {
    id: "place.x", title: "Hafen", subtitle: "Am Wasser", district: "Unterstadt", address: "Hafenstraße 1 SECRET_ADDRESS",
    summary: "Dunkles Wasser.", atmosphere: rich([{ type: "paragraph", children: [{ text: "Salz" }] }]), worldState: "destroyed",
    image: "/api/locations/media?id=SECRET_MEDIA", discovery: "known", markers: ["watched"], geography: { status: "exact", coordinates: [6.1, 51.7] },
    areas: [{ title: "SECRET_AREA" }], knownInformation: [{ title: "SECRET_INFO", text: "SECRET_TEXT" }], activity: [{ label: "SECRET_ACTIVITY" }],
    factionSignals: [{ label: "SECRET_FACTION" }], media: [{ url: "/api/locations/media?id=SECRET_MEDIA" }], preparedActions: [{ label: "SECRET_ACTION" }],
    slNotes: [{ text: "SECRET_SL" }],
  };
  const place = publicPlace(projected);
  assert.deepEqual(Object.keys(place).sort(), ["atmosphere", "district", "id", "image", "subtitle", "summary", "title", "worldState"]);
  assert.equal(place.image, "");
  assert.equal(place.worldState, "destroyed");
  assert.ok(!JSON.stringify(place).includes("SECRET"));
  for (const discovery of ["hidden", "rumored", undefined]) assert.equal(publicPlace({ ...projected, discovery }), null, String(discovery));
  assert.equal(publicPlace({ ...projected, navigationOnly: true }), null);
  assert.equal(publicPlace({ ...projected, discovery: "investigated", image: "/images/kleve.png" }).image, "/images/kleve.png");
});

test("a person shows only allowlisted, already released fields", () => {
  const person = publicPerson({ id: "npc-1", title: "Sophie", content: {
    alias: "Die Füchsin", title: "Harpyie", role: "Beraterin", clan: "Toreador", summary: "Kennt jeden.", text: "Langer Text",
    known_for: ["Feste", 3, ""], affiliation: ["Camarilla"], location_note: "SECRET_WHEREABOUTS", npc_status: "SECRET_STATUS",
    image_primary: "/api/files?id=SECRET_FILE", image: "/images/kleve.png", show_on_website: true, field_visibility: { name: "player_visible" },
  } });
  assert.deepEqual(Object.keys(person).sort(), ["affiliation", "alias", "clan", "description", "epithet", "id", "image", "knownFor", "name", "role", "summary"]);
  assert.equal(person.image, "/images/kleve.png");
  assert.deepEqual(person.knownFor, ["Feste"]);
  assert.ok(!JSON.stringify(person).includes("SECRET"));
  assert.equal(publicPerson({ id: "npc-2", title: "  ", content: {} }), null);
});

test("a chronicle entry keeps title, date, kind and text, never the session link", () => {
  const entry = publicChronicleEntry({ id: "c1", title: "Die Versammlung" }, { type: "rueckblick", date: "2026-03-12T20:00:00Z", text: "Es geschah.", sessionId: "SECRET_SESSION", showOnWebsite: true, source: "SECRET_SOURCE" });
  assert.deepEqual(entry && Object.keys(entry).sort(), ["date", "id", "kind", "text", "title"]);
  assert.equal(entry.date, "2026-03-12");
  assert.equal(entry.kind, "rueckblick");
  assert.ok(!JSON.stringify(entry).includes("SECRET"));
  assert.equal(publicChronicleEntry({ id: "c2", title: "x" }, { date: "kein Datum", summary: "Kurz" }).date, "");
  assert.equal(publicChronicleEntry({ id: "c2", title: "x" }, { summary: "Kurz" }).kind, "ereignis");
  const sorted = sortPublicChronicle([{ id: "a", title: "A", date: "", kind: "ereignis", text: "" }, { id: "b", title: "B", date: "2026-01-01", kind: "ereignis", text: "" }, { id: "c", title: "C", date: "2026-05-01", kind: "ereignis", text: "" }]);
  assert.deepEqual(sorted.map(item => item.id), ["c", "b", "a"]);
});

test("the NPC website flag is a schema key, not a releasable profile field", () => {
  assert.equal(npcProfileSchema.shape.show_on_website.safeParse(true).success, true);
  assert.equal(npcProfileSchema.shape.show_on_website.safeParse("ja").success, false);
  assert.equal(Object.hasOwn(npcFieldNames, "show_on_website"), false);
});

test("the public route has no write method and the page has no client code", () => {
  const route = readFileSync(new URL("../app/api/public-world/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /actor\(/, "the public read never requires or uses a login");
  for (const file of ["../app/kampagne/welt/page.tsx", "../app/kampagne/welt/public-rich-text.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /^\s*["']use client["']/m, file);
    assert.doesNotMatch(source, /<form|onClick|fetch\(/, file);
  }
  const server = readFileSync(new URL("../server/public-world.ts", import.meta.url), "utf8");
  assert.match(server, /audience='group'/, "only group knowledge is used");
  assert.match(server, /visibility='group'/, "only group chronicle entries qualify");
});
