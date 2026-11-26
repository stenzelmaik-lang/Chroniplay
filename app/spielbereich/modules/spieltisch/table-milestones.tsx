"use client";
// Spieltisch, Etappe 3: reached milestones as small tiles on the table map. Names and times only; the SL's reason stays hidden.
import { useEffect, useState } from "react";
import { api } from "../api-client";
import styles from "./table-milestones.module.css";

type Milestone = { label: string; reachedAt: string; granted: number };

export function TableMilestones() {
  const [list, setList] = useState<Milestone[] | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ milestones: Milestone[] }>("/api/locations/milestone")
      .then(result => { if (alive) setList(result.milestones); })
      .catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);
  if (!list || list.length === 0) return null;
  return <section className={styles.tiles} aria-label="Erspielte Meilensteine">
    <h3>Erspielt</h3>
    <ul>
      {list.map(item => <li key={item.label + item.reachedAt}>
        <strong>{item.label}</strong>
        <small>{new Date(item.reachedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · {item.granted} Erkenntnis{item.granted === 1 ? "" : "se"} im Wiki</small>
      </li>)}
    </ul>
  </section>;
}
