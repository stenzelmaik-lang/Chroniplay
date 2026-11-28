import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isMarkedForWebsite, parsePublicWorldIntro, publicChronicleEntry, publicImagePath, publicImageSource, publicPerson, publicPlace,
  publicRichText, publicStaticImage, publicTeaser, publicWorldIntroKey, publicWorldLimits, publicWorldOrderHints,
  sortPublicChronicle, uploadRef, websiteFlagKeys,
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

test("old entries (HTML, plain text, Markdown) lose protected file addresses and internal links", () => {
  const cases = {
    html: '<p>Vor dem Tor <a href="/spielbereich?bereich=schauplaetze&ort=FILE_A">Dossier</a></p><img src="/api/files?id=FILE_B" alt="Plan"><p>Ende <a href="https://example.invalid/kleve">extern</a></p>',
    plain: "Siehe Bild: /api/files?id=FILE_C und https://chroniplay.cc/api/cms/media?id=FILE_D&entityId=e sowie /sl/command-center?bereich=FILE_E",
    markdown: "Text ![Plan](/api/locations/media?id=FILE_F) weiter",
    absoluteLink: '<p><a href="https://chroniplay.cc/api/files?id=FILE_G">Bild</a></p>',
  };
  for (const [name, value] of Object.entries(cases)) {
    for (const out of [publicRichText(value), publicTeaser(value)]) {
      assert.ok(!/FILE_|\/api\/|spielbereich|command-center|<img|<p>/.test(out), name + ": " + out);
    }
  }
  assert.equal(publicTeaser(cases.html), "Vor dem Tor Dossier Ende extern", "HTML keeps its readable text");
  const htmlDocument = readRichText(publicRichText(cases.html));
  assert.ok(htmlDocument.blocks.some(block => block.children?.some(part => part.href === "https://example.invalid/kleve")), "external links survive");
  assert.equal(publicTeaser(cases.markdown), "Text weiter");
  assert.equal(publicRichText('<img src="/api/files?id=FILE_H">'), "", "an old image-only text is empty");
});

test("uploads are recognised only in the projection's own forms; previews, viewer links and foreign URLs are not", () => {
  assert.deepEqual(uploadRef("/api/files?id=abc-1"), { fileId: "abc-1" });
  assert.deepEqual(uploadRef("/api/files?id=abc-1&size=thumb"), { fileId: "abc-1" });
  assert.deepEqual(uploadRef("/api/cms/media?id=f-2&entityId=place.x&revisionId=r-1"), { fileId: "f-2" });
  assert.deepEqual(uploadRef("/api/locations/media?id=block-3"), { mediaBlockId: "block-3" });
  for (const value of [
    "/api/cms/media?id=f-2&entityId=place.x&revisionId=r-1&preview=1", "/api/locations/media?id=block-3&preview=1",
    "/api/cms/media?id=f-2&entityId=e&revisionId=r&viewerId=p1", "https://example.invalid/api/files?id=x", "//example.invalid/api/files?id=x",
    "/api/files?id=../x", "/api/files", "/api/other?id=x", "/images/kleve.png", "", null, 7,
  ]) assert.equal(uploadRef(value), null, String(value));
});

test("the public image path carries only kind and entry ID", () => {
  assert.equal(publicImagePath("person", "a b&c"), "/api/public-world/image?kind=person&id=a%20b%26c");
  const source = publicImageSource("place", "place.x", ["https://example.invalid/x.png", "/api/cms/media?id=FILE_SECRET&entityId=place.x&revisionId=r"]);
  assert.deepEqual(source, { image: "/api/public-world/image?kind=place&id=place.x", upload: { fileId: "FILE_SECRET" } });
  assert.ok(!source.image.includes("FILE_SECRET"));
  assert.deepEqual(publicImageSource("place", "p", ["/images/kleve.png", "/api/files?id=x"]), { image: "/images/kleve.png", upload: null });
  assert.deepEqual(publicImageSource("place", "p", [undefined, ""]), { image: "", upload: null });
});

test("the curated glimpse has fixed caps and says how the order is decided", () => {
  assert.deepEqual({ ...publicWorldLimits }, { places: 4, people: 7, chronicle: 3 });
  assert.match(publicWorldOrderHints.places, /4 Orte/);
  assert.match(publicWorldOrderHints.people, /7 Persönlichkeiten/);
  assert.match(publicWorldOrderHints.chronicle, /3 Einträge/);
});

test("the website intro document is read defensively and scoped per campaign", () => {
  assert.equal(publicWorldIntroKey("kampagne-a"), "public-world:intro:kampagne-a");
  assert.notEqual(publicWorldIntroKey("kampagne-a"), publicWorldIntroKey("kampagne-b"));
  assert.deepEqual(parsePublicWorldIntro(null), { text: "", version: 0, updatedAt: "" });
  assert.deepEqual(parsePublicWorldIntro("kaputt"), { text: "", version: 0, updatedAt: "" });
  assert.deepEqual(parsePublicWorldIntro(JSON.stringify({ text: "Hallo", version: 3, updatedAt: "2026-11-28", updatedBy: "sl" })), { text: "Hallo", version: 3, updatedAt: "2026-11-28" });
  assert.deepEqual(parsePublicWorldIntro(JSON.stringify({ text: 5, version: -1 })), { text: "", version: 0, updatedAt: "" });
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
  assert.equal(place.image, "/api/public-world/image?kind=place&id=place.x", "an upload is addressed by the entry, not by the file");
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
  assert.deepEqual(Object.keys(person).sort(), ["affiliation", "alias", "clan", "description", "epithet", "id", "image", "imageFocus", "knownFor", "name", "role", "summary"]);
  assert.equal(person.image, "/api/public-world/image?kind=person&id=npc-1", "the released primary portrait wins and is addressed by the entry");
  assert.equal(person.imageFocus, 0);
  assert.equal(publicPerson({ id: "npc-3", title: "Ohne Upload", content: { image: "/images/kleve.png", hero_position: 40 } }).image, "/images/kleve.png");
  assert.equal(publicPerson({ id: "npc-3", title: "Ohne Upload", content: { hero_position: 40 } }).imageFocus, 40);
  assert.equal(publicPerson({ id: "npc-4", title: "Ohne Bild", content: {} }).image, "");
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
  for (const file of ["../app/kampagne/welt/page.tsx", "../app/kampagne/welt/public-rich-text.tsx", "../app/kampagne/welt/content.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /^\s*["']use client["']/m, file);
    assert.doesNotMatch(source, /<form|onClick|fetch\(/, file);
  }
  const image = readFileSync(new URL("../app/api/public-world/image/route.ts", import.meta.url), "utf8");
  assert.match(image, /export async function GET/);
  assert.doesNotMatch(image, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(image, /actor\(/, "the public image never requires or uses a login");
  assert.match(image, /X-Content-Type-Options/);
  assert.match(image, /max-age=300/);
  const server = readFileSync(new URL("../server/public-world.ts", import.meta.url), "utf8");
  assert.match(server, /audience='group'/, "only group knowledge is used");
  assert.match(server, /row\.visibility === "group"/, "only group chronicle entries qualify");
});
