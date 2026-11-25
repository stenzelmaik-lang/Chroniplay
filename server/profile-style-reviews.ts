import { database, gmOnly, HttpError, type Actor } from "@/server/access";
import { readCustomPlayStyles, readStyleReviews, styleReviewInput, styleReviewStatus } from "@/domain/player-profile";

type ReviewProfile = { user_id: string; member_id: string; display_name: string; preferences: string };
const sharedProfiles = `
  SELECT u.id AS user_id, cm.user_id AS member_id, u.display_name, p.preferences
  FROM campaign_memberships cm
  JOIN auth_member_links l ON l.member_id=cm.user_id
  JOIN auth_users u ON u.id=l.auth_user_id AND u.status='active'
  JOIN auth_profiles p ON p.user_id=u.id
  WHERE cm.campaign_id=? AND cm.status='active'
    AND json_array_length(p.preferences, '$.customPlayStyles')>0
    AND EXISTS (
      SELECT 1 FROM json_each(p.preferences, '$.sharePlayerProfileCampaigns') WHERE value=cm.campaign_id
    )
`;

export async function profileStyleReviews(a: Actor) {
  gmOnly(a);
  const result = await database().prepare(sharedProfiles + " ORDER BY u.display_name, cm.user_id")
    .bind(a.campaignId).all<ReviewProfile>();
  return { reviews: result.results.flatMap(row => {
    const preferences = JSON.parse(row.preferences);
    const reviews = readStyleReviews(preferences.customPlayStyleReviews);
    return readCustomPlayStyles(preferences.customPlayStyles).map(style => ({
      memberId: row.member_id, name: row.display_name, style,
      status: styleReviewStatus(reviews, a.campaignId, style),
    }));
  }) };
}

export async function reviewProfileStyle(a: Actor, input: unknown) {
  gmOnly(a);
  const parsed = styleReviewInput.safeParse(input);
  if (!parsed.success) throw new HttpError(400, "Wähle eine Angabe und eine gültige Entscheidung.");
  const { memberId, style, decision } = parsed.data;
  const db = database();
  const row = await db.prepare(sharedProfiles + " AND cm.user_id=?").bind(a.campaignId, memberId).first<ReviewProfile>();
  if (!row) throw new HttpError(404, "Die Angabe ist für diese Kampagne nicht freigegeben.");
  const preferences = JSON.parse(row.preferences);
  const currentStyles = readCustomPlayStyles(preferences.customPlayStyles);
  if (!currentStyles.includes(style)) throw new HttpError(409, "Diese Angabe wurde geändert. Bitte neu laden.");

  const reviews = readStyleReviews(preferences.customPlayStyleReviews)
    .filter(review => review.campaignId !== a.campaignId || (review.style !== style && currentStyles.includes(review.style)));
  reviews.push({ campaignId: a.campaignId, style, decision });
  const updated = await db.prepare(`
    UPDATE auth_profiles SET preferences=json_set(preferences, '$.customPlayStyleReviews', json(?))
    WHERE user_id=? AND preferences=?
      AND EXISTS (SELECT 1 FROM campaign_memberships WHERE campaign_id=? AND user_id=? AND status='active')
  `).bind(JSON.stringify(reviews), row.user_id, row.preferences, a.campaignId, memberId).run();
  if (!updated.meta.changes) throw new HttpError(409, "Das Profil wurde inzwischen geändert. Bitte neu laden.");
  return { ok: true };
}
