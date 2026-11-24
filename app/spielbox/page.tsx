/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "../visitor/site-footer";
import { Spielbox } from "./spielbox";
import styles from "./spielbox.module.css";

/** Public page: no login, no server data. Results stay in the visitor's browser. */
export const metadata: Metadata = {
  title: "Spielbox",
  description: "Kleine Spiele für zwischendurch – ohne Anmeldung. Los geht es mit dem Rubikwürfel.",
  alternates: { canonical: "/spielbox" },
  openGraph: { url: "/spielbox", title: "Spielbox · ChroniPlay" },
};

export default function SpielboxSeite() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="ChroniPlay Startseite"><img src="/images/chroniplay-wordmark.png" alt="ChroniPlay" /></Link>
      <Link href="/" className={styles.back}><ArrowLeft aria-hidden="true" size={16} />Zur Startseite</Link>
    </header>
    <main className={styles.main}>
      <div className={styles.intro}>
        <p className={styles.kicker}>Spielbox</p>
        <h1>Kleine Spiele für zwischendurch.</h1>
        <p>Ohne Anmeldung, direkt im Browser. Deine Bestzeiten bleiben nur auf diesem Gerät – wir speichern nichts davon.</p>
      </div>
      <Spielbox />
    </main>
    <SiteFooter />
  </div>;
}
