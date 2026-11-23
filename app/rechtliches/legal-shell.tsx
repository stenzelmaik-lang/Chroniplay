/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "../visitor/site-footer";
import styles from "./legal.module.css";

type Props = { kicker: string; title: string; intro: ReactNode; stand: string; toc: { id: string; label: string }[]; children: ReactNode };

/** Rahmen für Impressum und Datenschutz im Stil der Startseite. */
export function LegalShell({ kicker, title, intro, stand, toc, children }: Props) {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="ChroniPlay Startseite"><img src="/images/chroniplay-wordmark.png" alt="ChroniPlay" /></Link>
      <Link href="/" className={styles.back}><ArrowLeft aria-hidden="true" size={16} />Zur Startseite</Link>
    </header>
    <main className={styles.main}>
      <div className={styles.hero}>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        <div className={styles.intro}>{intro}</div>
        <p className={styles.stand}>Stand: {stand}</p>
      </div>
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Inhalt"><p>Inhalt</p><ol>{toc.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.label}</a></li>)}</ol></nav>
        <div className={styles.content}>{children}</div>
      </div>
    </main>
    <SiteFooter />
  </div>;
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className={styles.section} aria-labelledby={`${id}-titel`}><h2 id={`${id}-titel`}>{title}</h2>{children}</section>;
}

export function Hinweis({ children }: { children: ReactNode }) {
  return <div className={styles.hinweis} role="note">{children}</div>;
}

export { styles as legalStyles };
