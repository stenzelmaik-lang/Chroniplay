"use client";
// Regie, Etappe 3: the SL reaches a milestone during play. Erkenntnisse bound to it become known to the group.
// Reaching is not reversible in this version, so the confirmation says so before anything is written.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../api-client";
import { useLocationDialog } from "../location-dialog";
import styles from "./regie-milestones.module.css";

type Milestone = { label: string; reachedAt: string; granted: number };
type Pending = { label: string; count: number };

export function RegieMilestones() {
  const dlg = useLocationDialog();
  const [name, setName] = useState("");
  const [list, setList] = useState<Milestone[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try { const result = await api<{ milestones: Milestone[]; pending?: Pending[] }>("/api/locations/milestone"); setList(result.milestones); setPending(result.pending ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : "Die Meilensteine konnten nicht geladen werden."); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function reach() {
    const label = name.replace(/\s+/g, " ").trim();
    if (!label) return;
    const match = pending.find(item => item.label === label);
    const question = match
      ? `Meilenstein „${label}“ erreichen? ${match.count} gebundene Erkenntnis${match.count === 1 ? "" : "se"} werden für die Runde bekannt. Das lässt sich nicht rückgängig machen.`
      : `Meilenstein „${label}“ erreichen? Keine gebundene Erkenntnis trägt diesen Namen. 0 Erkenntnisse würden freigespielt. Das lässt sich nicht rückgängig machen.`;
    if (!(await dlg.ask(question, "Erreichen"))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ already: boolean; granted: number }>("/api/locations/milestone", "POST", { label, reason: "In der Regie erreicht" });
      if (result.granted === 0) setNotice(result.already ? `„${label}“ war schon erreicht. Nichts Neues freigespielt.` : `„${label}“ erreicht. Keine Erkenntnis wartete darauf.`);
      else { setNotice(`„${label}“: ${result.granted} Erkenntnis${result.granted === 1 ? "" : "se"} freigespielt${result.already ? " (neu gebunden)" : ""}.`); toast.success("Meilenstein erreicht."); }
      setName("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Der Meilenstein konnte nicht erreicht werden."); }
    finally { setBusy(false); }
  }

  return <div className={styles.box}>
    <p className={styles.lead}>Ein Meilenstein ist ein Ereignis der Geschichte, zum Beispiel „Der Rundgang“. Erkenntnisse im Ort, die an diesen Namen gebunden sind, werden dann für die Runde bekannt.</p>
    <div className={styles.row}>
      <label className="field"><span>Name des Meilensteins</span><input value={name} maxLength={80} disabled={busy} placeholder="z. B. Der Rundgang" list="regie-milestones" onChange={event => setName(event.target.value)} /></label>
      <datalist id="regie-milestones">{[...pending.map(item => item.label), ...list.map(item => item.label)].map(label => <option key={label} value={label} />)}</datalist>
      <button type="button" className={styles.reach} disabled={busy || !name.trim()} onClick={() => void reach()}>Meilenstein erreichen</button>
    </div>
    {pending.length > 0 && <div className={styles.suggest} aria-label="Gebundene Meilensteine">
      <span>Gebunden, noch nicht erreicht:</span>
      {pending.map(item => <button key={item.label} type="button" disabled={busy} onClick={() => setName(item.label)}>{item.label} · {item.count}</button>)}
    </div>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {list.length > 0 && <ul className={styles.list} aria-label="Erreichte Meilensteine">
      {list.map(item => <li key={item.label + item.reachedAt}><strong>{item.label}</strong><small>{new Date(item.reachedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {item.granted} Erkenntnis{item.granted === 1 ? "" : "se"}</small></li>)}
    </ul>}
    {dlg.dialog}
  </div>;
}
