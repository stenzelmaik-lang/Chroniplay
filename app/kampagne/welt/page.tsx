/* eslint-disable @next/next/no-img-element */
// Öffentliche Welt: read-only page for guests. Renders only the public projection (server/public-world.ts) on the
// server; there is no client component, no form and no action on this page.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, MapPin, Users } from "lucide-react";
import { KLEVE_CAMPAIGN_ID } from "@/domain/types";
import { publicTeaser, type PublicChronicleEntry, type PublicPerson, type PublicPlace, type PublicWorld } from "@/domain/public-world";
import { database } from "@/server/database";
import { loadPublicWorld } from "@/server/public-world";
import { SiteFooter } from "@/app/visitor/site-footer";
import { PublicRichText } from "./public-rich-text";
import styles from "./welt.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Die Welt · Chronik von Kleve",
  description: "Orte, Persönlichkeiten und Ereignisse der Chronik von Kleve, freigegeben von der Spielleitung.",
};

const worldStateLabels: Record<string, string> = { changed: "Verändert", inaccessible: "Unzugänglich", destroyed: "Zerstört", abandoned: "Verlassen" };
const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "UTC" });
const dateLabel = (date: string) => date ? dateFormat.format(new Date(date + "T00:00:00Z")) : "Ohne Datum";
const initials = (name: string) => name.split(/\s+/).filter(word => /^\p{L}/u.test(word)).slice(0, 2).map(word => word[0].toUpperCase()).join("");

function Empty({ text }: { text: string }) {
  return <p className={styles.sectionEmpty}>{text}</p>;
}

function PlaceCard({ place }: { place: PublicPlace }) {
  const teaser = publicTeaser(place.summary) || publicTeaser(place.atmosphere);
  const state = worldStateLabels[place.worldState];
  const more = Boolean(place.atmosphere) || publicTeaser(place.summary, 100000) !== teaser;
  return <article className={styles.card} id={"ort-" + encodeURIComponent(place.id)}>
    <div className={styles.cardMedia} data-empty={!place.image || undefined}>
      {place.image ? <img src={place.image} alt={"Bild von " + place.title} loading="lazy" decoding="async" /> : <MapPin aria-hidden="true" size={30} />}
      {state && <span className={styles.stateBadge}>{state}</span>}
    </div>
    <div className={styles.cardBody}>
      {(place.district || place.subtitle) && <p className={styles.overline}>{[place.district, place.subtitle].filter(Boolean).join(" · ")}</p>}
      <h3>{place.title}</h3>
      {teaser && <p className={styles.teaser}>{teaser}</p>}
      {more && <details className={styles.more}><summary>Weiterlesen</summary>
        <PublicRichText value={place.summary} />
        {place.atmosphere && <><h4 className={styles.moreHeading}>Eindruck</h4><PublicRichText value={place.atmosphere} /></>}
      </details>}
    </div>
  </article>;
}

function PersonCard({ person }: { person: PublicPerson }) {
  const teaser = publicTeaser(person.summary) || publicTeaser(person.description);
  const byline = [person.epithet, person.alias && "„" + person.alias + "“"].filter(Boolean).join(" · ");
  const chips = [person.clan, person.role].filter(Boolean);
  const more = Boolean(person.description || person.knownFor.length || person.affiliation.length) || publicTeaser(person.summary, 100000) !== teaser;
  return <article className={styles.card} id={"person-" + encodeURIComponent(person.id)}>
    <div className={styles.portrait} data-empty={!person.image || undefined}>
      {person.image ? <img src={person.image} alt={"Porträt von " + person.name} loading="lazy" decoding="async" style={{ objectPosition: `center ${person.imageFocus}%` }} /> : <span aria-hidden="true">{initials(person.name)}</span>}
    </div>
    <div className={styles.cardBody}>
      <h3>{person.name}</h3>
      {byline && <p className={styles.overline}>{byline}</p>}
      {chips.length > 0 && <p className={styles.chips}>{chips.map(chip => <span key={chip}>{chip}</span>)}</p>}
      {teaser && <p className={styles.teaser}>{teaser}</p>}
      {more && <details className={styles.more}><summary>Weiterlesen</summary>
        <PublicRichText value={person.summary} />
        <PublicRichText value={person.description} />
        {person.knownFor.length > 0 && <><h4 className={styles.moreHeading}>Bekannt für</h4><ul className={styles.plainList}>{person.knownFor.map(item => <li key={item}>{item}</li>)}</ul></>}
        {person.affiliation.length > 0 && <><h4 className={styles.moreHeading}>Zugehörigkeiten</h4><ul className={styles.plainList}>{person.affiliation.map(item => <li key={item}>{item}</li>)}</ul></>}
      </details>}
    </div>
  </article>;
}

function ChronicleItem({ entry }: { entry: PublicChronicleEntry }) {
  const teaser = publicTeaser(entry.text, 260);
  const more = publicTeaser(entry.text, 100000) !== teaser;
  return <li className={styles.event} id={"eintrag-" + encodeURIComponent(entry.id)}>
    <div className={styles.eventMeta}>{entry.date ? <time dateTime={entry.date}>{dateLabel(entry.date)}</time> : <span>{dateLabel("")}</span>}<span className={styles.kindTag}>{entry.kind === "rueckblick" ? "Rückblick" : "Ereignis"}</span></div>
    <h3>{entry.title}</h3>
    {teaser && <p className={styles.teaser}>{teaser}</p>}
    {more && <details className={styles.more}><summary>Weiterlesen</summary><PublicRichText value={entry.text} /></details>}
  </li>;
}

export default async function WeltPage() {
  let world: PublicWorld | null = null;
  try { world = await loadPublicWorld(database(), KLEVE_CAMPAIGN_ID); }
  catch (error) { console.error("CVK public world failed", error); }
  const total = world ? world.places.length + world.people.length + world.chronicle.length : 0;
  const nav = [
    { href: "#orte", label: "Orte", count: world?.places.length ?? 0, Icon: MapPin },
    { href: "#persoenlichkeiten", label: "Persönlichkeiten", count: world?.people.length ?? 0, Icon: Users },
    { href: "#chronik", label: "Chronik", count: world?.chronicle.length ?? 0, Icon: BookOpen },
  ];
  return <main className={styles.page}>
    <header className={styles.bar}>
      <Link href="/" className={styles.brand} aria-label="ChroniPlay Startseite"><img src="/images/chroniplay-wordmark.png" alt="ChroniPlay" /></Link>
      <Link href="/kampagne" className={styles.back}><ArrowLeft aria-hidden="true" size={16} />Kampagne</Link>
    </header>
    <section className={styles.hero} aria-labelledby="welt-title">
      <img className={styles.heroImage} src="/images/chronik-von-kleve-banner.png" alt="" />
      <div className={styles.heroCopy}>
        <p className={styles.kicker}>Chronik von Kleve</p>
        <h1 id="welt-title">Die Welt</h1>
        <p>Orte, Persönlichkeiten und Ereignisse, die die Spielleitung für alle freigegeben hat. Alles Weitere bleibt im geschützten Spielbereich.</p>
      </div>
    </section>
    {!world ? <section className={styles.notice} role="alert"><h2>Gerade nicht erreichbar</h2><p>Die Welt lässt sich im Moment nicht laden. Bitte versuche es später noch einmal.</p></section>
    : total === 0 ? <section className={styles.notice} aria-labelledby="welt-leer"><h2 id="welt-leer">Noch ist nichts veröffentlicht</h2><p>Die Spielleitung gibt nach und nach Orte, Persönlichkeiten und Ereignisse frei. Schau bald wieder vorbei.</p><Link className={styles.action} href="/kampagne">Zur Kampagnenseite</Link></section>
    : <>
      <nav className={styles.sectionNav} aria-label="Bereiche der Welt">{nav.map(({ href, label, count, Icon }) => <a key={href} href={href}><Icon aria-hidden="true" size={16} />{label}<span>{count}</span></a>)}</nav>
      <section id="orte" className={styles.section} aria-labelledby="orte-title">
        <h2 id="orte-title">Orte</h2>
        {world.places.length ? <div className={styles.grid}>{world.places.map(place => <PlaceCard key={place.id} place={place} />)}</div> : <Empty text="Noch keine Orte veröffentlicht." />}
      </section>
      <section id="persoenlichkeiten" className={styles.section} aria-labelledby="personen-title">
        <h2 id="personen-title">Persönlichkeiten</h2>
        {world.people.length ? <div className={styles.grid}>{world.people.map(person => <PersonCard key={person.id} person={person} />)}</div> : <Empty text="Noch keine Persönlichkeiten veröffentlicht." />}
      </section>
      <section id="chronik" className={styles.section} aria-labelledby="chronik-title">
        <h2 id="chronik-title">Chronik</h2>
        {world.chronicle.length ? <ol className={styles.timeline}>{world.chronicle.map(entry => <ChronicleItem key={entry.id} entry={entry} />)}</ol> : <Empty text="Noch keine Ereignisse veröffentlicht." />}
      </section>
    </>}
    <SiteFooter />
  </main>;
}
