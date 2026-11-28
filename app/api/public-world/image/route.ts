import { env } from "cloudflare:workers";
import { KLEVE_CAMPAIGN_ID } from "@/domain/types";
import { database, failure, HttpError } from "@/server/access";
import { loadPublicImageFile } from "@/server/public-world";

export const dynamic = "force-dynamic";

/** Öffentliche Welt: the image of a public entry, addressed by kind and entry ID, never by file. No login, no cookie,
 * only GET. Everything that is not on the public page (unmarked, unknown to the group, archived, unreleased portrait,
 * unknown ID, wrong kind) gets the same 404. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id") ?? "";
    if ((kind !== "place" && kind !== "person") || !id || id.length > 200) throw new HttpError(404, "Bild nicht gefunden.");
    const file = await loadPublicImageFile(database(), KLEVE_CAMPAIGN_ID, kind, id);
    if (!file || !env.BUCKET) throw new HttpError(404, "Bild nicht gefunden.");
    const object = await env.BUCKET.get(file.key);
    if (!object) throw new HttpError(404, "Bild nicht gefunden.");
    return new Response(object.body, {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.size),
        "Content-Disposition": "inline",
        // Five minutes: long enough that one page visit loads each image once, short enough that an entry the SL takes
        // off the website stops being served from browser and proxy caches soon. Errors stay "no-store" (json helper).
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return failure(error, req);
  }
}
