declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CVK_ENGAGEMENT_ENABLED?: string;
    CVK_ENGAGEMENT_AWARDS_ENABLED?: string;
    CVK_PRIVACY_CONTROLLER?: string;
    CVK_PRIVACY_CONTACT?: string;
    CVK_IMPRESSUM_NAME?: string;
    CVK_IMPRESSUM_ANSCHRIFT?: string;
    CVK_IMPRESSUM_EMAIL?: string;
    CVK_IMPRESSUM_TELEFON?: string;
    CVK_WERBUNG_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
