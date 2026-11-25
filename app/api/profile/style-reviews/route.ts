import { actor, failure, input, json, sameOrigin } from "@/server/access";
import { profileStyleReviews, reviewProfileStyle } from "@/server/profile-style-reviews";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return json(await profileStyleReviews(await actor()));
  } catch (error) {
    return failure(error, req);
  }
}

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    return json(await reviewProfileStyle(await actor(), await input(req, 1024)));
  } catch (error) {
    return failure(error, req);
  }
}
