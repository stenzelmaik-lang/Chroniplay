import { z } from "zod";
import { actor, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { setPlaceWebsite } from "@/server/public-world";

export const dynamic = "force-dynamic";
const schema = z.object({ entityId: z.string().min(1).max(160), expectedRevision: z.number().int().min(0), show: z.boolean() }).strict();

/** SL only: "Auf der Website zeigen" for a main place. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const data = schema.safeParse(await input(req));
    if (!data.success) throw new HttpError(400, "Ungültige Website-Freigabe.");
    return json(await setPlaceWebsite(database(), a, data.data));
  } catch (error) {
    return failure(error, req);
  }
}
