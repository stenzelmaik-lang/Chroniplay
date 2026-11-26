"use client";
import { boardLinkKindNames, type BoardLinkKind } from "@/domain/storyboard-blocks";
import type { RegieLink, RegiePending } from "./types";

/** Storyboard 2.0 in the Regie: where the story can go from here. Orientation only; the SL decides at the table.
 * Old free-text branches (`possibilities`) are still shown beside it until they are converted in the storyboard. */
export function RegieLinks({ links, pending, noteClassName, headingLevel = 3 }: { links: RegieLink[] | undefined; pending?: RegiePending[]; noteClassName: string; headingLevel?: 3 | 4 }) {
  const H = headingLevel === 3 ? "h3" : "h4";
  return <>{pending?.length ? <section aria-label="Aus Handlungssträngen vorgemerkt">
    <H>Aus Handlungssträngen vorgemerkt</H>
    {pending.map(item => <article key={item.id} className={noteClassName}>
      <p><strong>{item.kind}: {item.title}</strong> <em>({item.state}{item.deadline ? " · " + item.deadline : ""})</em></p>
      {item.text && <p>{item.text}</p>}
      <p><small>Strang: {item.thread}</small></p>
    </article>)}
  </section> : null}{links?.length ? <section aria-label="Mögliche Weiterführungen">
    <H>Mögliche Weiterführungen</H>
    {links.map(link => <article key={link.to} className={noteClassName}>
      <p><strong>{boardLinkKindNames[link.kind as BoardLinkKind] || "Weiter"} → {link.title || "Szene nicht verfügbar"}</strong></p>
      {link.label && <p>{link.label}</p>}
      {link.condition && <p><em>Wenn: {link.condition}</em></p>}
    </article>)}
  </section> : null}</>;
}
