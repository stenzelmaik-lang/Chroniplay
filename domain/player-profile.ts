import { z } from "zod";

export const illustratedProfileBanners = [
  "chroni-magierin", "zeitwolf", "uhrmacher", "weisses-kaninchen", "sternenkompass", "mondportal", "wuerfelsiegel",
] as const;
export const classicProfileBanners = ["neon", "fog", "candle"] as const;
export const profileBanners = [...illustratedProfileBanners, ...classicProfileBanners] as const;
export type ProfileBanner = typeof profileBanners[number];

type Motif = { label: string; base: string; accent: string; position?: string; gradient?: string };
const bannerMotifs: Record<ProfileBanner, Motif> = {
  "chroni-magierin": { label: "Chroni-Magierin", base: "#241a31", accent: "#c0a2df", position: "36%" },
  zeitwolf: { label: "Zeitwolf", base: "#182630", accent: "#a6c6db", position: "36%" },
  uhrmacher: { label: "Uhrmacher", base: "#2f231b", accent: "#dfad67", position: "36%" },
  "weisses-kaninchen": { label: "Weißes Kaninchen", base: "#1a2337", accent: "#aab8e3", position: "33%" },
  sternenkompass: { label: "Sternenkompass", base: "#142c30", accent: "#b2c7a9", position: "52%" },
  mondportal: { label: "Mondportal", base: "#231f34", accent: "#c4b8e1", position: "48%" },
  wuerfelsiegel: { label: "Würfelsiegel", base: "#32202b", accent: "#dda6ae", position: "48%" },
  neon: { label: "Neon im Regen", base: "#241a35", accent: "#d5aad3", gradient: "linear-gradient(115deg,#241a35,#43253c,#182938)" },
  fog: { label: "Rheinnebel", base: "#142126", accent: "#9fbeb5", gradient: "linear-gradient(115deg,#142126,#354745,#17242a)" },
  candle: { label: "Kerzenlicht", base: "#302225", accent: "#dfad67", gradient: "radial-gradient(ellipse at 75% 15%,#6a4427,#302225 65%,#181a25)" },
};

export function profileMotif(value: unknown) {
  const id = profileBanners.find(banner => banner === value) ?? "fog";
  const motif = bannerMotifs[id];
  return { ...motif, image: motif.gradient ? undefined : "/images/profilmotive/" + id + ".webp" };
}

export function profileMotifCover(value: unknown) {
  const { base, gradient, image, position } = profileMotif(value);
  return gradient ?? ('linear-gradient(90deg,' + base + ' 17%,' + base + 'eb 42%,' + base + '18 100%), url("' + image + '") right ' + position + ' / auto 148% no-repeat ' + base);
}

export const profilePlayStyles = [
  "Ermittlungen", "Intrigen", "Charakterdrama", "Horror", "Taktik", "Improvisation",
  "Spuren & Rätsel", "Düstere Atmosphäre", "Charakterentwicklung", "Entscheidungen mit Folgen",
  "Gemeinsames Erzählen", "Welten erkunden", "Kreative Lösungen", "Spielszenen ausspielen",
] as const;
export const PROFILE_STYLE_LIMIT = 8;
export const CUSTOM_STYLE_LIMIT = 3;
export const CUSTOM_STYLE_LENGTH = 40;
export const profilePlayPaces = ["calm", "balanced", "quick"] as const;
export const profilePaceLabels: Record<typeof profilePlayPaces[number], string> = {
  calm: "Ruhig & atmosphärisch", balanced: "Ausgewogen", quick: "Zügig & fokussiert",
};

export const customPlayStyle = z.string().max(80).transform(value => value.normalize("NFC").trim().replace(/ +/g, " "))
  .pipe(z.string().min(2).max(CUSTOM_STYLE_LENGTH).regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} &'’+\-/]*$/u, "Schreib einen kurzen Spielstil ohne Links oder Sonderzeichen."));

export const styleKey = (value: string) => value.toLocaleLowerCase("de-DE");
const standardStyleKeys = new Set(profilePlayStyles.map(styleKey));
export const customPlayStylesInput = z.array(customPlayStyle).max(CUSTOM_STYLE_LIMIT).refine(styles => {
  const keys = styles.map(styleKey);
  return new Set(keys).size === keys.length && keys.every(key => !standardStyleKeys.has(key));
}, "Eigene Spielstile dürfen sich nicht wiederholen oder bereits in der Liste stehen.");

const reviewDecisions = ["approved", "blocked"] as const;
export type StyleReviewStatus = typeof reviewDecisions[number] | "pending";
export const styleReviewInput = z.object({
  memberId: z.string().min(1).max(160),
  style: customPlayStyle,
  decision: z.enum(reviewDecisions),
}).strict();

const storedStyleReview = z.object({
  campaignId: z.string().min(1).max(160),
  style: customPlayStyle,
  decision: z.enum(reviewDecisions),
});

export function readProfilePlayStyles(value: unknown) {
  return Array.isArray(value) ? profilePlayStyles.filter(style => value.includes(style)).slice(0, PROFILE_STYLE_LIMIT) : [];
}

export function readCustomPlayStyles(value: unknown) {
  const parsed = customPlayStylesInput.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readStyleReviews(value: unknown) {
  return Array.isArray(value) ? value.flatMap(review => {
    const parsed = storedStyleReview.safeParse(review);
    return parsed.success ? [parsed.data] : [];
  }) : [];
}

export function styleReviewStatus(reviews: ReturnType<typeof readStyleReviews>, campaignId: string, style: string): StyleReviewStatus {
  return reviews.find(review => review.campaignId === campaignId && review.style === style)?.decision ?? "pending";
}

export function campaignProfilePresentation(preferences: Record<string, unknown>, campaignId: string) {
  const shares = preferences.sharePlayerProfileCampaigns;
  if (!Array.isArray(shares) || !shares.includes(campaignId)) return null;
  const reviews = readStyleReviews(preferences.customPlayStyleReviews);
  const approved = readCustomPlayStyles(preferences.customPlayStyles)
    .filter(style => styleReviewStatus(reviews, campaignId, style) === "approved");
  return {
    pronouns: typeof preferences.pronouns === "string" ? preferences.pronouns : "",
    introduction: typeof preferences.introduction === "string" ? preferences.introduction : "",
    banner: profileBanners.find(banner => banner === preferences.banner) ?? "fog",
    playStyles: [...readProfilePlayStyles(preferences.playStyles), ...approved],
    playPace: profilePlayPaces.find(pace => pace === preferences.playPace) ?? null,
  };
}
