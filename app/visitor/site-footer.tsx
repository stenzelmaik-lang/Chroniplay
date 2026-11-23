/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { DiscordLogo, GitHubLogo } from "./community-logos";
import { visitorContent } from "./content";
import styles from "./site-footer.module.css";

const extern = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Gemeinsame Fußzeile der öffentlichen Seiten (Startseite, Impressum, Datenschutz). */
export function SiteFooter() {
  const { discord, github } = visitorContent.community;
  return <footer className={styles.footer}>
    <div className={styles.top}>
      <Link href="/" className={styles.brand} aria-label="ChroniPlay Startseite"><img className={styles.logo} src="/images/chroniplay-wordmark.png" alt="ChroniPlay" /></Link>
      <span className={styles.claim}>Eine Plattform für gemeinsame Geschichten.</span>
      <nav className={styles.community} aria-label="Community"><a href={discord.href} {...extern}><DiscordLogo size={18} />Discord</a><a href={github.repoHref} {...extern}><GitHubLogo size={18} />GitHub</a></nav>
    </div>
    <div className={styles.bottom}>
      <span>© 2026 ChroniPlay · Alle Rechte vorbehalten · Geschlossene Alpha</span>
      <nav className={styles.legal} aria-label="Rechtliches"><Link href="/impressum">Impressum</Link><Link href="/datenschutz">Datenschutz</Link></nav>
    </div>
  </footer>;
}
