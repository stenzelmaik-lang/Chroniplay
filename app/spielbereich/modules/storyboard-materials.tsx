"use client";
import { useEffect, useMemo, useState } from "react";
import { BookMarked, Hand, Library, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { authoringTextMax } from "@/domain/authoring-limits";
import type { CommandReference } from "@/domain/command-workspace";
import { defaultMaterial, isMaterialElement, materialTypeInfo, withMaterial, type DisplayAsset } from "@/domain/material-system";
import { entryFromElement, libraryMaterialTypes, type MaterialEntry, type MaterialEntryView } from "@/domain/material-library";
import { sceneMaterialUseLimits, type SceneCast, type SceneElement, type SceneMaterialUse } from "@/domain/story-scene";
import { MaterialEditor, type SaveState } from "./material/workbench";
import type { PickerFile } from "./material/file-picker";
import { RichTextEditor } from "./rich-text";
import { api } from "./api-client";
import s from "./storyboard.module.css";

/** Szene 2.0, Etappe 3: material area. The library holds every material once (Spielmaterial 3.0); the scene only
 * uses it – how it comes into play, by whom, under which condition, for whom, pocketable or not. The server mirrors
 * each use into a classic element, so the current Regie plays it out unchanged. */

const howNames: Record<SceneMaterialUse["how"], string> = { open: "Liegt offen", search: "Durch Untersuchung", handover: "Wird übergeben", other: "Anders" };
type Editing = { id: string; version: number; element: SceneElement; dirty: boolean; useAfterCreate: boolean };

const toElement = (entry: MaterialEntry, id: string): SceneElement => withMaterial({ id, kind: "object", title: entry.title, text: entry.text, referenceId: "", fileId: "" }, entry.material);
const toEntry = (e: SceneElement, base?: MaterialEntry): MaterialEntry => ({ title: e.title.trim() || "Material", text: e.text, material: e.material!, tags: base?.tags || [], archived: base?.archived || false });
const newUse = (materialId: string, takeable = true, id: string = crypto.randomUUID()): SceneMaterialUse => ({ id, materialId, how: "open", byNpcId: "", condition: "", audience: "", takeable });

export function MaterialArea({ elements, uses, cast, references, files, actorId, classicHref, onFilesChange, onUses, onBeforeLibrarySave, onLibrarySaved, onAsk }: {
  elements: SceneElement[]; uses: SceneMaterialUse[]; cast: SceneCast[]; references: CommandReference[]; files: PickerFile[]; actorId: string; classicHref: string;
  onFilesChange: (files: PickerFile[]) => void; onUses: (next: SceneMaterialUse[]) => void; onBeforeLibrarySave: () => Promise<boolean>; onLibrarySaved: () => Promise<void>; onAsk: (question: string) => Promise<boolean>;
}) {
  const [library, setLibrary] = useState<MaterialEntryView[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [assets, setAssets] = useState<DisplayAsset[]>([]);
  const [search, setSearch] = useState(""), [choosing, setChoosing] = useState(false), [editing, setEditing] = useState<Editing | null>(null), [saveState, setSaveState] = useState<SaveState>("clean");
  useEffect(() => {
    let live = true;
    Promise.all([api<{ materials: MaterialEntryView[] }>("/api/command-center/materials"), api<{ assets: DisplayAsset[] }>("/api/display-assets").catch(() => ({ assets: [] as DisplayAsset[] }))])
      .then(([l, d]) => { if (live) { setLibrary(l.materials); setAssets(d.assets); } }).catch(e => { if (live) setError((e as Error).message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const byId = useMemo(() => new Map(library.map(m => [m.id, m])), [library]);
  const npcName = new Map(references.filter(r => r.type === "NPC").map(r => [r.id, r.title]));
  const usedIds = new Set(uses.map(u => u.materialId));
  const useIds = new Set(uses.map(u => u.id));
  const classic = elements.filter(e => isMaterialElement(e) && !useIds.has(e.id));
  const q = search.trim().toLocaleLowerCase("de");
  const shelf = library.filter(m => !m.document.archived && (!q || (m.document.title + " " + m.document.tags.join(" ") + " " + materialTypeInfo[m.document.material.type].label).toLocaleLowerCase("de").includes(q)));
  const updateUse = (id: string, patch: Partial<SceneMaterialUse>) => onUses(uses.map(u => u.id === id ? { ...u, ...patch } : u));

  function startNew(type: typeof libraryMaterialTypes[number]) {
    const info = materialTypeInfo[type];
    setEditing({ id: "", version: 0, element: toElement({ title: info.label, text: "", material: defaultMaterial(type), tags: [], archived: false }, crypto.randomUUID()), dirty: true, useAfterCreate: true });
    setChoosing(false); setSaveState("dirty");
  }
  function edit(entry: MaterialEntryView) { setEditing({ id: entry.id, version: entry.version, element: toElement(entry.document, entry.id), dirty: false, useAfterCreate: false }); setSaveState("clean"); }
  async function close() {
    if (editing?.dirty && !(await onAsk("Ungespeicherte Änderungen an diesem Material verwerfen?"))) return;
    setEditing(null);
  }
  async function saveEntry() {
    if (!editing) return;
    setSaveState("saving"); setError("");
    try {
      if (!(await onBeforeLibrarySave())) throw new Error("Die Szene konnte vorher nicht gespeichert werden.");
      const base = editing.id ? byId.get(editing.id)?.document : undefined;
      const body = editing.id ? { action: "save", id: editing.id, version: editing.version, document: toEntry(editing.element, base) } : { action: "create", clientRequestId: crypto.randomUUID(), document: toEntry(editing.element) };
      const result = await api<{ material: MaterialEntryView; scenes: { refreshed: string[]; skipped: string[] } }>("/api/command-center/materials", "POST", body);
      setLibrary(list => [...list.filter(m => m.id !== result.material.id), result.material].sort((x, y) => x.document.title.localeCompare(y.document.title, "de")));
      setEditing({ id: result.material.id, version: result.material.version, element: toElement(result.material.document, result.material.id), dirty: false, useAfterCreate: false });
      setSaveState("saved");
      if (editing.useAfterCreate && uses.length < sceneMaterialUseLimits.uses) onUses([...uses, newUse(result.material.id, result.material.document.material.takeable !== false)]);
      else await onLibrarySaved();
      if (result.scenes.skipped.length) setError(result.scenes.skipped.length + " Szene(n) wurden gerade bearbeitet; ihre Kopie aktualisiert sich beim nächsten Speichern.");
    } catch (e) { setSaveState("error"); setError((e as Error).message); }
  }
  async function adopt(e: SceneElement) {
    const entry = entryFromElement(e);
    if (!entry) return;
    setError("");
    try {
      const result = await api<{ material: MaterialEntryView }>("/api/command-center/materials", "POST", { action: "create", clientRequestId: crypto.randomUUID(), document: entry });
      setLibrary(list => [...list, result.material].sort((x, y) => x.document.title.localeCompare(y.document.title, "de")));
      // Same id as the classic element: table objects that refer to it stay stable.
      onUses([...uses, newUse(result.material.id, entry.material.takeable !== false, e.id)]);
    } catch (err) { setError((err as Error).message); }
  }
  async function removeUse(u: SceneMaterialUse) {
    const title = byId.get(u.materialId)?.document.title || elements.find(e => e.id === u.id)?.title || "Material";
    if (!(await onAsk("„" + title + "“ aus dieser Szene nehmen? In der Bibliothek bleibt es erhalten."))) return;
    onUses(uses.filter(x => x.id !== u.id));
  }

  if (editing) return <div className={s.wsLibraryEditor}>
    {error && <p className={s.wsError} role="alert">{error}</p>}
    <MaterialEditor element={editing.element} files={files} assets={assets} players={[]} actorId={actorId} sceneFileIds={[]} saveState={saveState}
      editor={(value, change, label, key) => <RichTextEditor key={key} value={value} onChange={change} label={label} maximumPlainLength={authoringTextMax} placeholder="Inhalt des Materials …" advanced htmlSource compactTools preparationTools files={files} />}
      onChange={element => { setEditing(cur => cur ? { ...cur, element, dirty: true } : cur); setSaveState("dirty"); }}
      onClose={() => void close()} onSave={() => void saveEntry()} onFilesChange={onFilesChange} onAssetsChange={setAssets} />
    <div className={s.pageActions}><button type="button" className={s.ghost} onClick={() => void close()}>Zurück zur Szene</button><button type="button" className={s.primary} disabled={saveState === "saving" || !editing.dirty} onClick={() => void saveEntry()}>{editing.id ? "In der Bibliothek speichern" : "In die Bibliothek legen und verwenden"}</button></div>
    {editing.id && <p className={s.viewHint}>Speichern aktualisiert dieses Material in allen Szenen, die es verwenden.</p>}
  </div>;

  return <div className={s.wsMaterials}>
    {error && <p className={s.wsError} role="alert">{error}</p>}
    <section className={s.wsUses} aria-labelledby="sb-uses">
      <h4 id="sb-uses" className={s.wsSub}><BookMarked size={13} aria-hidden="true" /> In dieser Szene · {uses.length}</h4>
      {!uses.length && <p className={s.planBlank}>Noch kein Material aus der Bibliothek. Wähle unten etwas aus oder lege Neues an. Jedes Material gibt es nur einmal: wer es einsteckt, hat es.</p>}
      {uses.map(u => {
        const entry = byId.get(u.materialId), title = entry?.document.title || elements.find(e => e.id === u.id)?.title || "Material nicht verfügbar";
        return <article key={u.id} className={s.wsUse}>
          <div className={s.wsCastHead}>
            <span className={s.wsCastName}><span><b>{title}</b><small>{entry ? materialTypeInfo[entry.document.material.type].label : "nicht mehr in der Bibliothek – die Kopie bleibt"}{u.takeable ? " · einsteckbar" : " · bleibt liegen"}</small></span></span>
            <span className={s.wsTools}>
              {entry && <button type="button" aria-label={"In der Bibliothek bearbeiten: " + title} onClick={() => edit(entry)}><Pencil size={14} aria-hidden="true" /></button>}
              <button type="button" aria-label={"Aus der Szene nehmen: " + title} onClick={() => void removeUse(u)}><Trash2 size={14} aria-hidden="true" /></button>
            </span>
          </div>
          <div className={s.wsUseGrid}>
            <label className={s.field}><span>Wie kommt es ins Spiel?</span>
              <select value={u.how} onChange={e => updateUse(u.id, { how: e.target.value as SceneMaterialUse["how"], ...(e.target.value === "handover" ? {} : { byNpcId: "" }) })}>
                {(Object.keys(howNames) as SceneMaterialUse["how"][]).map(h => <option key={h} value={h}>{howNames[h]}</option>)}
              </select></label>
            {u.how === "handover" && <label className={s.field}><span>Übergeben von</span>
              <select value={u.byNpcId} onChange={e => updateUse(u.id, { byNpcId: e.target.value })}>
                <option value="">– noch offen –</option>
                {cast.map(c => <option key={c.id} value={c.npcId}>{npcName.get(c.npcId) || "NSC"}</option>)}
                {u.byNpcId && !cast.some(c => c.npcId === u.byNpcId) && <option value={u.byNpcId}>{npcName.get(u.byNpcId) || "NSC"} · nicht beteiligt</option>}
              </select></label>}
            <label className={s.field}><span>Bedingung</span><input maxLength={sceneMaterialUseLimits.condition} value={u.condition} placeholder="z. B. nach gelungener Untersuchung des Tischs" onChange={e => updateUse(u.id, { condition: e.target.value })} /></label>
            <label className={s.field}><span>Für wen</span><input maxLength={sceneMaterialUseLimits.audience} value={u.audience} placeholder="z. B. wer Emil untersucht – oder alle" onChange={e => updateUse(u.id, { audience: e.target.value })} /></label>
          </div>
          <label className={s.wsCheck}><input type="checkbox" checked={u.takeable} onChange={() => updateUse(u.id, { takeable: !u.takeable })} /><Hand size={14} aria-hidden="true" /> Spieler können es einstecken</label>
        </article>;
      })}
    </section>

    {classic.length > 0 && <section className={s.wsOffer}>
      <h4 className={s.wsSub}>Klassisches Material dieser Szene · {classic.length}</h4>
      <p className={s.viewHint}>Diese Stücke liegen nur in dieser Szene. In die Bibliothek übernommen, kannst du sie in anderen Szenen wiederverwenden; am Spieltisch ändert sich nichts.</p>
      <ul className={s.wsList}>{classic.map(e => <li key={e.id}><span>{e.title}<small> · {e.material ? materialTypeInfo[e.material.type].label : "Baustein"}</small></span>
        {entryFromElement(e) ? <button type="button" className={s.ghost} disabled={uses.length >= sceneMaterialUseLimits.uses} onClick={() => void adopt(e)}>In die Bibliothek übernehmen</button> : <small>bleibt in der Szene (Pager oder ohne Materialblock)</small>}</li>)}</ul>
      <p className={s.viewHint}><a className={s.linkButton} href={classicHref} target="_blank" rel="noopener noreferrer">Klassisches Material bearbeiten</a></p>
    </section>}

    <section className={s.wsShelf} aria-labelledby="sb-shelf">
      <div className={s.wsShelfHead}>
        <h4 id="sb-shelf" className={s.wsSub}><Library size={13} aria-hidden="true" /> Bibliothek · {library.filter(m => !m.document.archived).length}</h4>
        <label className={s.wsSearch}><Search size={14} aria-hidden="true" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Material suchen …" aria-label="Material in der Bibliothek suchen" /></label>
        <button type="button" className={s.primary} aria-expanded={choosing} onClick={() => setChoosing(!choosing)}><Plus size={15} aria-hidden="true" />Neues Material</button>
      </div>
      {choosing && <ul className={s.wsTypes}>{libraryMaterialTypes.map(t => <li key={t}><button type="button" onClick={() => startNew(t)}><b>{materialTypeInfo[t].label}</b><small>{materialTypeInfo[t].hint}</small></button></li>)}</ul>}
      {loading ? <p className={s.viewHint}>Bibliothek wird geladen …</p> : !shelf.length ? <p className={s.planBlank}>{library.length ? "Nichts passt zur Suche." : "Die Bibliothek ist noch leer."}</p> :
        <ul className={s.wsList}>{shelf.map(m => <li key={m.id}><span>{m.document.title}<small> · {materialTypeInfo[m.document.material.type].label}{m.document.tags.length ? " · " + m.document.tags.join(", ") : ""}</small></span>
          <span className={s.wsShelfActions}>
            <button type="button" className={s.ghost} onClick={() => edit(m)}><Pencil size={14} aria-hidden="true" />Bearbeiten</button>
            <button type="button" className={s.ghost} disabled={usedIds.has(m.id) || uses.length >= sceneMaterialUseLimits.uses} onClick={() => onUses([...uses, newUse(m.id, m.document.material.takeable !== false)])}>{usedIds.has(m.id) ? "In dieser Szene" : "In Szene verwenden"}</button>
          </span></li>)}</ul>}
    </section>
  </div>;
}
