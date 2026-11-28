import { z } from "zod";
import { publicWorldIntroMaxSource } from "@/domain/public-world";
import { actor, database, failure, HttpError, input, json, sameOrigin } from "@/server/access";
import { requireCmsPublisher } from "@/server/location-cms-service";
import { loadPublicWorldOverview, savePublicWorldIntro } from "@/server/public-world";

export const dynamic = "force-dynamic";
const schema = z.object({ text: z.string().max(publicWorldIntroMaxSource), expectedVersion: z.number().int().min(0) }).strict();

/** SL only: the website overview (what is shown, what the cap cuts) and the current introduction. */
export async function GET(req: Request) {
  try {
    return json(await loadPublicWorldOverview(database(), await actor()));
  } catch (error) {
    return failure(error, req);
  }
}

/** SL only: save "Einleitung für die Website". */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    requireCmsPublisher(a);
    const data = schema.safeParse(await input(req, publicWorldIntroMaxSource + 2000));
    if (!data.success) throw new HttpError(400, "Ungültige Einleitung.");
    return json(await savePublicWorldIntro(database(), a, data.data));
  } catch (error) {
    return failure(error, req);
  }
}
