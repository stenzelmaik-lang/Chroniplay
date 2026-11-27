import { KLEVE_CAMPAIGN_ID } from "@/domain/types";
import { database, failure, json } from "@/server/access";
import { loadPublicWorld } from "@/server/public-world";

export const dynamic = "force-dynamic";

/** Öffentliche Welt: read-only, no login. Everyone (guest, player, SL) gets the same public projection; only entries
 * the SL explicitly marked for the website and the group already sees. There is deliberately no write method. */
export async function GET(req: Request) {
  try {
    return json(await loadPublicWorld(database(), KLEVE_CAMPAIGN_ID));
  } catch (e) {
    return failure(e, req);
  }
}
