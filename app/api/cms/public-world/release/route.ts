import { z } from "zod";
import { actor, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { requireCmsPublisher } from "@/server/location-cms-service";
import { savePublicWorldMarks } from "@/server/public-world";

export const dynamic = "force-dynamic";
const ids = z.array(z.string().min(1).max(200)).max(500);
const schema = z.object({ places: ids, people: ids, chronicle: ids }).strict();

/** SL only: "Für die Website freigeben" from the central list (complete wanted sets per section). */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    requireCmsPublisher(a);
    const data = schema.safeParse(await input(req));
    if (!data.success) throw new HttpError(400, "Ungültige Website-Freigabe.");
    return json(await savePublicWorldMarks(database(), a, data.data));
  } catch (error) {
    return failure(error, req);
  }
}
