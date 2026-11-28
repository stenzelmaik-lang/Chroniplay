/* eslint-disable @next/next/no-img-element */
// Öffentliche Welt: a curated, read-only glimpse for guests. Renders only the public projection (server/public-world.ts)
// on the server; no client component, no form, no action. Details open in place with native <details>, so keyboard and
// focus work without script, and any motion is limited to prefers-reduced-motion: no-preference.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, MapPin, Users } from "lucide-react";
import { KLEVE_CAMPAIGN_ID } from "@/domain/types";
import { publicTeaser, type PublicChronicleEntry, type PublicPerson, type PublicPlace, type PublicWorld } from "@/domain/public-world";
import { database } from "@/server/database";
import { loadPublicWorld } from "@/server/public-world";
import { SiteFooter } from "@/app/visitor/site-footer";
import { defaultWorldIntro } from "./content";
import { PublicRichText } from "./public-rich-text";
import styles from "./welt.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Die Welt · Chronik von Kleve",
  description: "Ein Einblick in die Chronik von Kleve: ausgewählte Orte, Persönlichkeiten und Ereignisse, freigegeben von der Spielleitung.",
};

const worldStateLabels: Record<string, string> = { changed: "Verändert", inaccessible: "Unzugänglich", destroyed: "Zerstört", abandoned: "Verlassen" };
const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "UTC" });
const dateLabel = (date: string) => date ? dateFormat.format(new Date(date + "T00:00:00Z")) : "Ohne Datum";
const initials = (name: string) => name.split(/\s+/).filter(word => /^\p{L}/u.test(word)).slice(0, 2).map(word => word[0].toUpperCase()).join("");

function Toggle({ open, close }: { open: string; close: string }) {
  return <summary><span className={styles.whenClosed}>{open}</span><span className={styles.whenOpen}>{close}</span></summary>;
}

function PlaceShowcase({ place }: { place: PublicPlace }) {
  const teaser = publicTeaser(place.summary, 280) || publicTeaser(place.atmosphere, 280);
  const state = worldStateLabels[place.worldState];
  const more = Boolean(place.atmosphere) || publicTeaser(place.summary, 100000) !== teaser;
  return <article className={styles.showcase} id={"ort-" + encodeURIComponent(place.id)} aria-labelledby={"ort-titel-" + encodeURIComponent(place.id)}>
    <div className={styles.showcaseMedia} data-empty={!place.image || undefined}>
      {place.image ? <img src={place.image} alt={"Bild von " + place.title} loading="lazy" decoding="async" /> : <MapPin aria-hidden="true" size={40} />}
      {state && <span className={styles.stateBadge}>{state}</span>}
    </div>
    <div className={styles.showcaseText}>
      {(place.district || place.subtitle) && <p className={styles.overline}>{[place.district, place.subtitle].filter(Boolean).join(" · ")}</p>}
      <h3 id={"ort-titel-" + encodeURIComponent(place.id)}>{place.title}</h3>
      {teaser && <p className={styles.teaser}>{teaser}</p>}
      {more && <details className={styles.more}><Toggle open="Mehr über den Ort" close="Weniger anzeigen" />
        <div className={styles.moreBody}>
          <PublicRichText value={place.summary} />
          {place.atmosphere && <><h4 className={styles.moreHeading}>Atmosphäre</h4><PublicRichText value={place.atmosphere} /></>}
        </div>
      </details>}
    </div>
  </article>;
}

function PersonPortrait({ person }: { person: PublicPerson }) {
  const teaser = publicTeaser(person.summary, 320) || publicTeaser(person.description, 320);
  const byline = [person.epithet, person.alias && "„" + person.alias + "“"].filter(Boolean).join(" · ");
  const chips = [person.clan, person.role].filter(Boolean);
  const summaryCut = publicTeaser(person.summary, 100000) !== teaser;
  const more = Boolean(person.description || person.knownFor.length || person.affiliation.length) || summaryCut;
  return <article className={styles.figure} data-summary-cut={summaryCut || undefined} id={"person-" + encodeURIComponent(person.id)} aria-labelledby={"person-name-" + encodeURIComponent(person.id)}>
    <div className={styles.figureMedia} data-empty={!person.image || undefined}>
      {person.image
        ? <img src={person.image} alt={"Bild von " + person.name} loading="lazy" decoding="async" />
        : <span aria-hidden="true">{initials(person.name)}</span>}
    </div>
    <div className={styles.figureText}>
      <h3 id={"person-name-" + encodeURIComponent(person.id)}>{person.name}</h3>
      {byline && <p className={styles.overline}>{byline}</p>}
      {chips.length > 0 && <p className={styles.chips}>{chips.map(chip => <span key={chip}>{chip}</span>)}</p>}
      {teaser && <p className={styles.teaser}>{teaser}</p>}
      {more && <details className={styles.more}><Toggle open="Biografie" close="Weniger anzeigen" />
        <div className={styles.moreBody}>
          {summaryCut && <PublicRichText value={person.summary} />}
          <PublicRichText value={person.description} />
          {person.knownFor.length > 0 && <><h4 className={styles.moreHeading}>Bekannt für</h4><ul className={styles.plainList}>{person.knownFor.map(item => <li key={item}>{item}</li>)}</ul></>}
          {person.affiliation.length > 0 && <><h4 className={styles.moreHeading}>Zugehörigkeiten</h4><ul className={styles.plainList}>{person.affiliation.map(item => <li key={item}>{item}</li>)}</ul></>}
        </div>
      </details>}
    </div>
  </article>;
}

function ChronicleExcerpt({ entry }: { entry: PublicChronicleEntry }) {
  const excerpt = publicTeaser(entry.text, 200);
  return <article className={styles.excerpt} id={"eintrag-" + encodeURIComponent(entry.id)}>
    <p className={styles.excerptMeta}>{entry.date ? <time dateTime={entry.date}>{dateLabel(entry.date)}</time> : <span>{dateLabel("")}</span>}<span>{entry.kind === "rueckblick" ? "Rückblick" : "Ereignis"}</span></p>
    <h3>{entry.title}</h3>
    {excerpt && <blockquote>{excerpt}</blockquote>}
  </article>;
}

export default async function WeltPage() {
  let world: PublicWorld | null = null;
  try { world = await loadPublicWorld(database(), KLEVE_CAMPAIGN_ID); }
  catch (error) { console.error("CVK public world failed", error); }
  const total = world ? world.places.length + world.people.length + world.chronicle.length : 0;
  const nav = world ? [
    { href: "#orte", label: "Orte", show: world.places.length > 0, Icon: MapPin },
    { href: "#persoenlichkeiten", label: "Persönlichkeiten", show: world.people.length > 0, Icon: Users },
    { href: "#chronik", label: "Chronik", show: world.chronicle.length > 0, Icon: BookOpen },
  ].filter(item => item.show) : [];
  return <main className={styles.page}>
    <header className={styles.bar}>
      <Link href="/" className={styles.brand} aria-label="ChroniPlay Startseite"><img src="/images/chroniplay-wordmark.png" alt="ChroniPlay" /></Link>
      <Link href="/kampagne" className={styles.back}><ArrowLeft aria-hidden="true" size={16} />Kampagne</Link>
    </header>
    <section className={styles.hero} aria-labelledby="welt-title">
      <img className={styles.heroImage} src="/images/chronik-von-kleve-banner.png" alt="" />
      <div className={styles.heroCopy}>
        <p className={styles.kicker}>Chronik von Kleve · Ein Einblick</p>
        <h1 id="welt-title">Die Welt</h1>
      </div>
    </section>
    <section className={styles.story} aria-labelledby="geschichte-title">
      <p className={styles.kicker}>Worum es geht</p>
      <h2 id="geschichte-title">Die Geschichte</h2>
      {world?.intro ? <PublicRichText value={world.intro} className={styles.storyText} /> : <div className={`${styles.prose} ${styles.storyText}`}><p>{defaultWorldIntro}</p></div>}
    </section>
    {!world ? <section className={styles.notice} role="alert"><h2>Gerade nicht erreichbar</h2><p>Die Welt lässt sich im Moment nicht laden. Bitte versuche es später noch einmal.</p></section>
    : total === 0 ? <section className={styles.notice} aria-labelledby="welt-leer"><h2 id="welt-leer">Noch ist nichts veröffentlicht</h2><p>Die Spielleitung zeigt hier bald ausgewählte Orte, Persönlichkeiten und Ereignisse. Schau bald wieder vorbei.</p></section>
    : <>
      {nav.length > 1 && <nav className={styles.sectionNav} aria-label="Bereiche der Welt">{nav.map(({ href, label, Icon }) => <a key={href} href={href}><Icon aria-hidden="true" size={16} />{label}</a>)}</nav>}
      {world.places.length > 0 && <section id="orte" className={styles.section} aria-labelledby="orte-title">
        <p className={styles.kicker}>Schauplätze</p>
        <h2 id="orte-title">Orte</h2>
        <div className={styles.showcaseList}>{world.places.map(place => <PlaceShowcase key={place.id} place={place} />)}</div>
      </section>}
      {world.people.length > 0 && <section id="persoenlichkeiten" className={styles.section} aria-labelledby="personen-title">
        <p className={styles.kicker}>Begegnungen</p>
        <h2 id="personen-title">Persönlichkeiten</h2>
        <div className={styles.figureList}>{world.people.map(person => <PersonPortrait key={person.id} person={person} />)}</div>
      </section>}
      {world.chronicle.length > 0 && <section id="chronik" className={styles.section} aria-labelledby="chronik-title">
        <p className={styles.kicker}>Aus der Chronik</p>
        <h2 id="chronik-title">Chronik</h2>
        <div className={styles.excerptGrid}>{world.chronicle.map(entry => <ChronicleExcerpt key={entry.id} entry={entry} />)}</div>
      </section>}
    </>}
    <section className={styles.cta} aria-labelledby="mitspielen-title">
      <div>
        <p className={styles.kicker}>Mitspielen</p>
        <h2 id="mitspielen-title">Werde Teil der Chronik</h2>
        <p>Die Chronik von Kleve wird in einer geschlossenen Alpha gespielt. Neugierig geworden? Mit einer Einladung geht es hier weiter.</p>
      </div>
      <div className={styles.ctaActions}>
        <Link className={styles.primaryAction} href="/anmelden">Zur geschlossenen Alpha <ArrowRight aria-hidden="true" size={17} /></Link>
        <Link className={styles.outlineAction} href="/#projekt">ChroniPlay entdecken</Link>
      </div>
    </section>
    <SiteFooter />
  </main>;
}
