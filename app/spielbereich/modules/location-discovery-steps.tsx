"use client";
// Orte: what the players know about a section, as a short ladder instead of a dropdown.
import type { DiscoveryState } from "@/domain/location-types";
import cmsStyles from "./location-cms.module.css";
import { DiscoveryIcon } from "./location-icons";

const steps: { id: DiscoveryState; label: string; hint: string }[] = [
  { id: "hidden", label: "Unbekannt", hint: "Die Spieler wissen nichts davon." },
  { id: "rumored", label: "Gerücht", hint: "Die Spieler haben davon gehört." },
  { id: "known", label: "Bekannt", hint: "Die Spieler wissen, dass es das gibt." },
  { id: "visited", label: "Besucht", hint: "Die Spieler waren dort." },
  { id: "investigated", label: "Untersucht", hint: "Die Spieler haben es genau untersucht." },
];

export function DiscoverySteps({ value, onChange, label, withHidden = false, current, disabled = false }: {
  value: DiscoveryState; onChange: (next: DiscoveryState) => void; label: string;
  /** Offer "Unbekannt" as a choice (only for administrative corrections). */
  withHidden?: boolean;
  /** What the players know today; marked on the ladder. */
  current?: DiscoveryState;
  disabled?: boolean;
}) {
  const shown = withHidden ? steps : steps.slice(1);
  const reached = shown.findIndex(step => step.id === value);
  return <div className={cmsStyles.discoverySteps} role="radiogroup" aria-label={label}>
    <span className={cmsStyles.discoveryStepsLabel}>{label}</span>
    <div className={cmsStyles.discoveryStepsRow}>
      {shown.map((step, index) => <button key={step.id} type="button" role="radio" aria-checked={step.id === value} disabled={disabled}
        data-reached={index <= reached || undefined} data-current={step.id === current || undefined} title={step.hint + (step.id === current ? " (heutiger Stand)" : "")}
        onClick={() => onChange(step.id)}>
        <DiscoveryIcon state={step.id} />{step.label}
      </button>)}
    </div>
    <small>{shown[reached]?.hint}</small>
  </div>;
}
