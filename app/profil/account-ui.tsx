"use client";
/* eslint-disable @next/next/no-img-element -- The profile uses protected media and a local image preview. */
/* eslint-disable @next/next/no-location-assign-relative-destination -- Signing out discards protected client state. */
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, ImagePlus, LogOut, ShieldCheck } from "lucide-react";
import {
  classicProfileBanners, customPlayStylesInput, CUSTOM_STYLE_LENGTH, CUSTOM_STYLE_LIMIT, illustratedProfileBanners,
  profileMotif, profileMotifCover, profilePaceLabels, profilePlayPaces, profilePlayStyles, PROFILE_STYLE_LIMIT,
  type ProfileBanner, type StyleReviewStatus,
} from "@/domain/player-profile";
import { CpIcon } from "@/app/spielbereich/modules/icons/cp-icons";
import { FeedbackSection } from "./feedback-ui";
import styles from "./profile.module.css";

type Mutation = { ok: boolean; logout?: boolean; id?: string; token?: string };
export async function accountApi<T = Mutation>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Der Kontodienst ist momentan nicht erreichbar. Bitte erneut versuchen.");
  }
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Der Vorgang konnte nicht abgeschlossen werden.");
  return data;
}

type Preferences = {
  reducedMotion: boolean;
  compactView: boolean;
  engagementTracking: boolean;
  headerName: "account" | "character";
  realName?: string;
  introduction?: string;
  pronouns?: string;
  banner?: ProfileBanner;
  playStyles?: Array<typeof profilePlayStyles[number]>;
  customPlayStyles?: string[];
  playPace?: typeof profilePlayPaces[number] | null;
  sharePlayerProfileCampaigns?: string[];
};
type Profile = {
  displayName: string;
  email: string;
  version: number;
  avatarFileId: string | null;
  preferences: Preferences;
  styleReviews?: { campaignId: string; style: string; status: StyleReviewStatus }[];
  campaigns: { id: string; name: string; status: string }[];
};
type Session = { id: string; expiresAt: string; lastSeenAt: string; current: boolean };
type AvatarDraft = { file: File; url: string; uploadedId?: string };
const reviewLabels: Record<StyleReviewStatus, string> = {
  pending: "In Prüfung", approved: "Freigegeben", blocked: "Gesperrt",
};
const sections = [
  { id: "spielerprofil", label: "Spielerprofil", icon: <CpIcon name="character" /> },
  { id: "konto", label: "Konto & Anzeige", icon: <CpIcon name="regie" /> },
  { id: "sicherheit", label: "Sicherheit", icon: <ShieldCheck aria-hidden="true" size={22} strokeWidth={1.5} /> },
  { id: "feedback", label: "Feedback", icon: <CpIcon name="letter" /> },
] as const;
const date = (value: string) => new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Bitte erneut versuchen.";

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function Avatar({ src, name }: { src?: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return src && src !== failedSrc
    ? <img className={styles.avatar} src={src} alt="" onError={() => setFailedSrc(src)} />
    : <span className={styles.avatar} aria-hidden="true">{Array.from(name.trim())[0]?.toLocaleUpperCase("de-DE") || "?"}</span>;
}

async function uploadAvatar(file: File) {
  const body = new FormData();
  body.set("file", file);
  body.set("visibility", "private");
  const response = await fetch("/api/files", { method: "POST", body });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Dein Profilbild konnte nicht hochgeladen werden. Bitte erneut versuchen.");
  }
  const data = await response.json() as { id?: string; error?: string };
  if (!response.ok || !data.id) throw new Error(data.error ?? "Dein Profilbild konnte nicht hochgeladen werden.");
  return data.id;
}

export default function AccountProfile({ engagementAvailable }: { engagementAvailable: boolean }) {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const active = hash === "#aktivitaetsmessung" ? "konto" : sections.find(section => "#" + section.id === hash)?.id ?? "spielerprofil";
  const editing = active === "spielerprofil" || active === "konto";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [characterName, setCharacterName] = useState<string | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [customStyle, setCustomStyle] = useState("");
  const [styleError, setStyleError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const previewUrl = avatarDraft?.url;
  const hasChanges = dirty || avatarDraft !== null;
  const loaded = profile !== null;

  useEffect(() => {
    let active = true;
    void accountApi<Profile>("/api/profile").then(data => { if (active) setProfile(data); })
      .catch(error => { if (active) setError(errorMessage(error)); });
    void accountApi<{ sessions: Session[] }>("/api/auth/sessions").then(data => { if (active) setSessions(data.sessions); })
      .catch(error => { if (active) setSessionError(errorMessage(error)); });
    void accountApi<{ characterName: string | null }>("/api/profile/header-name").then(data => {
      if (active) setCharacterName(data.characterName);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!loaded) return;
    const sectionId = hash === "#aktivitaetsmessung"
      ? (engagementAvailable ? "aktivitaetsmessung" : "konto")
      : sections.find(section => "#" + section.id === hash)?.id;
    if (!sectionId) return;
    const target = document.getElementById(sectionId);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }, [loaded, hash, engagementAvailable]);

  function updateProfile(changes: Partial<Pick<Profile, "displayName" | "avatarFileId">>) {
    setProfile(current => current ? { ...current, ...changes } : current);
    setDirty(true);
    setNotice("");
  }

  function updatePreferences(changes: Partial<Preferences>) {
    setProfile(current => current ? { ...current, preferences: { ...current.preferences, ...changes } } : current);
    setDirty(true);
    setNotice("");
  }

  function selectAvatar(file?: File) {
    if (!file) return;
    setAvatarError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      setAvatarError("Wähle ein JPG-, PNG- oder WebP-Bild bis 2 MB.");
      return;
    }
    setAvatarDraft({ file, url: URL.createObjectURL(file) });
    setError("");
    setNotice("");
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || busy || !hasChanges) return;
    const displayName = profile.displayName.trim();
    if (!displayName) {
      window.location.hash = "spielerprofil";
      setError("Bitte gib einen Nickname ein.");
      return;
    }
    await run(async () => {
      let avatarFileId = profile.avatarFileId;
      if (avatarDraft) {
        avatarFileId = avatarDraft.uploadedId ?? await uploadAvatar(avatarDraft.file);
        setAvatarDraft({ ...avatarDraft, uploadedId: avatarFileId });
      }
      const { preferences, version } = profile;
      const saved = await accountApi<{ version: number }>("/api/profile", "PATCH", {
        version, displayName, avatarFileId, preferences,
      });
      setProfile({
        ...profile, version: saved.version, displayName, avatarFileId,
        preferences: {
          ...preferences, realName: preferences.realName?.trim(),
          pronouns: preferences.pronouns?.trim(), introduction: preferences.introduction?.trim(),
        },
      });
      setAvatarDraft(null);
      setDirty(false);
      setNotice("Dein Profil wurde dauerhaft gespeichert.");
    });
  }

  async function revoke(id?: string) {
    if (!window.confirm(id ? "Diese Sitzung abmelden?" : "Alle anderen Geräte abmelden?")) return;
    await run(async () => {
      const response = await accountApi("/api/auth/sessions", "POST", id ? { action: "revoke", id } : { action: "revoke_others" });
      if (response.logout) {
        window.location.assign("/anmelden");
        return;
      }
      setSessions(current => current?.filter(session => id ? session.id !== id : session.current) ?? null);
      setNotice(id ? "Die Sitzung wurde abgemeldet." : "Die anderen Geräte wurden abgemeldet.");
    });
  }

  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    await run(async () => {
      await accountApi("/api/auth/password", "POST", { ...fields, version: profile.version });
      form.reset();
      window.location.assign("/anmelden");
    });
  }

  const preferences = profile?.preferences;
  const banner = preferences?.banner ?? "fog";
  const avatarSrc = previewUrl ?? (profile?.avatarFileId ? "/api/profile/avatar?v=" + profile.version : undefined);
  const chosen = preferences?.playStyles ?? [];
  const custom = preferences?.customPlayStyles ?? [];
  const shared = preferences?.sharePlayerProfileCampaigns ?? [];
  const campaigns = profile?.campaigns.filter(campaign => campaign.status === "active") ?? [];

  function addCustomStyle() {
    const result = customPlayStylesInput.safeParse([...custom, customStyle]);
    if (!result.success) {
      setStyleError("Gib einen kurzen Spielstil ein, der noch nicht in der Liste steht. Links und Sonderzeichen sind nicht zulässig.");
      return;
    }
    updatePreferences({ customPlayStyles: result.data });
    setCustomStyle("");
    setStyleError("");
  }

  function motifOption(motif: ProfileBanner) {
    const appearance = profileMotif(motif);
    return <label className={styles.motif} key={motif} style={{ background: appearance.gradient ?? appearance.base }}>
      {appearance.image && <img src={appearance.image} alt="" width={384} height={384} loading="lazy" />}
      <span className={styles.motifLabel}>
        <input type="radio" name="profile-banner" value={motif} checked={motif === banner} onChange={() => updatePreferences({ banner: motif })} />
        <span>{appearance.label}</span><span className={styles.motifColor} style={{ background: appearance.accent }} aria-hidden="true" />
      </span>
    </label>;
  }

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <a className={styles.returnLink} href="/spielbereich"><ArrowLeft size={17} aria-hidden="true" /> Zum Spielbereich</a>
        <img className={styles.brand} src="/images/chroniplay-profil-logo.webp" alt="ChroniPlay" width={320} height={107} />
        <button className={styles.logout} type="button" disabled={busy} onClick={() => void run(async () => {
          await accountApi("/api/auth/logout", "POST");
          window.location.assign("/anmelden");
        })}><LogOut size={16} aria-hidden="true" /> Abmelden</button>
      </div>
    </header>

    <div className={styles.container}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>Profil &amp; Einstellungen</p>
          <h1>Mein Profil</h1>
          <p>Gestalte deine Spielerkarte und verwalte dein Konto.</p>
        </div>
      </header>

      <div className={styles.workspace}>
        <nav className={styles.navigation} aria-label="Profilbereiche">
          {sections.map(section => <a key={section.id} href={"#" + section.id} aria-current={active === section.id ? "location" : undefined}>
            {section.icon}<span>{section.label}</span><ChevronRight className={styles.chevron} size={15} aria-hidden="true" />
          </a>)}
        </nav>

        <div className={styles.content}>
          {(!editing || !profile) && error && <p role="alert" className={styles.error}>{error}</p>}
          {!editing && notice && <p role="status" className={styles.success}>{notice}</p>}
          {!editing && hasChanges && <p className={styles.pendingDraft}><a href="#spielerprofil">Zum ungespeicherten Profilentwurf</a></p>}
          {!profile || !preferences ? (
            error ? <button type="button" onClick={() => window.location.reload()}>Seite neu laden</button>
              : <p role="status" className={styles.empty}>Dein Profil wird geladen.</p>
          ) : <>
            <form className={styles.profileForm} onSubmit={save} hidden={!editing}>
              <div id="spielerprofil" tabIndex={-1} className={styles.editorLayout} hidden={active !== "spielerprofil"}>
                <section className={styles.card} aria-labelledby="profile-title">
                  <div className={styles.heading}>
                    <h2 id="profile-title">Deine Spielervorstellung</h2>
                    <p>Hier bearbeitest du die Spielerkarte, die du für deine Runde freigeben kannst.</p>
                  </div>
                  <fieldset className={styles.fields} disabled={busy}>
                    <fieldset className={styles.group}>
                      <legend>Eigener Avatar</legend>
                      <div className={styles.identity}>
                        <Avatar src={avatarSrc} name={profile.displayName} />
                        <div>
                          <div className={styles.avatarActions}>
                            <label className={styles.upload}>
                              <ImagePlus size={16} aria-hidden="true" /> {avatarSrc ? "Avatar ändern" : "Eigenes Bild auswählen"}
                              <input type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="avatar-hinweis" onChange={event => {
                                selectAvatar(event.currentTarget.files?.[0]);
                                event.currentTarget.value = "";
                              }} />
                            </label>
                            {avatarDraft ? <button className={styles.textButton} type="button" onClick={() => {
                              setAvatarDraft(null);
                              setAvatarError("");
                              setError("");
                            }}>Auswahl verwerfen</button> : profile.avatarFileId && <button className={styles.textButton} type="button" onClick={() => {
                              setAvatarError("");
                              updateProfile({ avatarFileId: null });
                            }}>Avatar entfernen</button>}
                          </div>
                          <small id="avatar-hinweis">JPG, PNG oder WebP bis 2 MB. Der Avatar erscheint neben deinem Namen auf der Spielerkarte.</small>
                          {avatarDraft && <small>Wird beim Speichern übernommen.</small>}
                          {avatarError && <small role="alert" className={styles.saveError}>{avatarError}</small>}
                        </div>
                      </div>
                    </fieldset>

                    <div className={styles.inputPair}>
                      <label>Nickname (Anzeigename)<input required={active === "spielerprofil"} maxLength={80} value={profile.displayName} onChange={event => updateProfile({ displayName: event.target.value })} /></label>
                      <label>Pronomen (optional)<input maxLength={40} value={preferences.pronouns ?? ""} onChange={event => updatePreferences({ pronouns: event.target.value })} /></label>
                    </div>
                    <label>Über mich<textarea rows={4} maxLength={600} value={preferences.introduction ?? ""} onChange={event => updatePreferences({ introduction: event.target.value })} /></label>

                    <fieldset id="profilmotiv" className={styles.group}>
                      <legend>Profilmotiv</legend>
                      <div className={styles.motifs}>{illustratedProfileBanners.map(motifOption)}</div>
                      <a className={styles.mobilePreviewLink} href="#profil-vorschau">Vorschau der Spielerkarte ansehen</a>
                      <details open={classicProfileBanners.some(motif => motif === banner)}>
                        <summary>Klassische Farbverläufe</summary>
                        <div className={styles.classicMotifs}>{classicProfileBanners.map(motifOption)}</div>
                      </details>
                    </fieldset>

                    <fieldset className={styles.group}>
                      <legend>So spiele ich <small>({chosen.length}/{PROFILE_STYLE_LIMIT})</small></legend>
                      <div className={styles.choices}>
                        {profilePlayStyles.map(style => {
                          const checked = chosen.includes(style);
                          return <label key={style} className={styles.check}>
                            <input type="checkbox" checked={checked} disabled={!checked && chosen.length >= PROFILE_STYLE_LIMIT} onChange={() => updatePreferences({
                              playStyles: checked ? chosen.filter(value => value !== style) : [...chosen, style],
                            })} />{style}
                          </label>;
                        })}
                      </div>
                      <div className={styles.customStyles}>
                        <small id="eigene-spielstile-hinweis">Bis zu drei eigene Spielstile. Die gewählte Spielleitung prüft sie vor der Anzeige. Beleidigungen, Diskriminierung und Belästigung werden gesperrt.</small>
                        <div className={styles.addStyle}>
                          <label>Eigener Spielstil<input value={customStyle} maxLength={CUSTOM_STYLE_LENGTH} disabled={custom.length >= CUSTOM_STYLE_LIMIT}
                            aria-describedby="eigene-spielstile-hinweis" onChange={event => { setCustomStyle(event.target.value); setStyleError(""); }}
                            onKeyDown={event => {
                              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                              event.preventDefault();
                              if (customStyle.trim()) addCustomStyle();
                            }} /></label>
                          <button type="button" disabled={!customStyle.trim() || custom.length >= CUSTOM_STYLE_LIMIT} onClick={addCustomStyle}>Hinzufügen</button>
                        </div>
                        {styleError && <small role="alert" className={styles.saveError}>{styleError}</small>}
                        {custom.length > 0 && <ul className={styles.customList}>{custom.map(style => <li className={styles.row} key={style}>
                          <div><strong>{style}</strong><small>{shared.length ? campaigns.filter(campaign => shared.includes(campaign.id)).map(campaign => {
                            const review = profile.styleReviews?.find(item => item.campaignId === campaign.id && item.style === style);
                            return campaign.name + " · " + reviewLabels[review?.status ?? "pending"];
                          }).join(" | ") : "Privater Entwurf"}</small></div>
                          <button type="button" aria-label={style + " entfernen"} onClick={() => updatePreferences({ customPlayStyles: custom.filter(value => value !== style) })}>Entfernen</button>
                        </li>)}</ul>}
                      </div>
                    </fieldset>

                    <label>Spieltempo (optional)<select value={preferences.playPace ?? ""} onChange={event => updatePreferences({
                      playPace: profilePlayPaces.find(pace => pace === event.target.value) ?? null,
                    })}>
                      <option value="">Keine Angabe</option>
                      {profilePlayPaces.map(pace => <option key={pace} value={pace}>{profilePaceLabels[pace]}</option>)}
                    </select></label>

                    <fieldset className={styles.group}>
                      <legend>Für deine Runde sichtbar</legend>
                      {campaigns.length ? <>
                        <small>Mitglieder der ausgewählten Kampagnen sehen deine Pronomen, dein Motiv, deine Vorstellung, deine freigegebenen Spielstile und dein Spieltempo.</small>
                        {campaigns.map(campaign => <label key={campaign.id} className={styles.check}>
                          <input type="checkbox" checked={shared.includes(campaign.id)} onChange={event => updatePreferences({
                            sharePlayerProfileCampaigns: event.target.checked ? [...shared, campaign.id] : shared.filter(id => id !== campaign.id),
                          })} />{campaign.name}
                        </label>)}
                      </> : <small>Sobald du in einer aktiven Kampagne spielst, kannst du deine Vorstellung für diese Runde freigeben.</small>}
                    </fieldset>
                  </fieldset>
                </section>

                <aside id="profil-vorschau" className={styles.preview} aria-labelledby="preview-label">
                  <p id="preview-label" className={styles.kicker}>Spielerkarte · private Vorschau</p>
                  <a className={styles.mobilePreviewLink} href="#profilmotiv">Zurück zu den Profilmotiven</a>
                  <article>
                    <header data-banner={banner} className={styles.previewBanner} style={{ background: profileMotifCover(banner) }}>
                      <Avatar src={avatarSrc} name={profile.displayName} />
                      <div><h2>{profile.displayName.trim() || "Dein Nickname"}</h2>
                        {preferences.pronouns && <span>{preferences.pronouns}</span>}
                      </div>
                    </header>
                    <div className={styles.previewBody}>
                      <h3>Über mich</h3>
                      <p>{preferences.introduction?.trim() || "Deine Vorstellung erscheint hier beim Schreiben."}</p>
                      {chosen.length + custom.length > 0 && <><h3>So spiele ich</h3><ul>{[...chosen, ...custom].map(style => <li key={style}>{style}</li>)}</ul></>}
                      {preferences.playPace && <><h3>Spieltempo</h3><p>{profilePaceLabels[preferences.playPace]}</p></>}
                    </div>
                  </article>
                </aside>
              </div>

              <section id="konto" tabIndex={-1} className={styles.card} hidden={active !== "konto"} aria-labelledby="settings-title">
                <div className={styles.heading}>
                  <h2 id="settings-title">Kontoeinstellungen</h2>
                  <p>Verwalte deine Kontodaten und passe die Ansicht am Spieltisch an.</p>
                </div>
                <fieldset className={styles.fields} disabled={busy}>
                  <div className={styles.inputPair}>
                    <label>E-Mail<input type="email" readOnly value={profile.email} /></label>
                    <label>Privater Name (optional)<input maxLength={100} value={preferences.realName ?? ""} onChange={event => updatePreferences({ realName: event.target.value })} /></label>
                  </div>
                  <fieldset className={styles.group}>
                    <legend>Oben in der Kopfleiste zeigen</legend>
                    <label className={styles.check}><input type="radio" name="headerName" value="account" checked={preferences.headerName !== "character"} onChange={() => updatePreferences({ headerName: "account" })} />Meinen Namen ({profile.displayName})</label>
                    <label className={styles.check}><input type="radio" name="headerName" value="character" checked={preferences.headerName === "character"} onChange={() => updatePreferences({ headerName: "character" })} />Meinen Charakter{characterName ? " (" + characterName + ")" : ""}</label>
                    <small>{characterName ? "Die Kopfleiste folgt deiner Charakterwahl in der Zuflucht." : "Bis du in der Zuflucht einen Charakter auswählst, zeigt die Kopfleiste deinen Namen."} Die Spielleitung sieht weiterhin deinen Kontonamen.</small>
                  </fieldset>
                  <fieldset className={styles.group}>
                    <legend>Darstellung</legend>
                    <label className={styles.check}><input type="checkbox" checked={preferences.reducedMotion} onChange={event => updatePreferences({ reducedMotion: event.target.checked })} />Animationen reduzieren</label>
                    <label className={styles.check}><input type="checkbox" checked={preferences.compactView} onChange={event => updatePreferences({ compactView: event.target.checked })} />Kompakte Spieltischansicht</label>
                  </fieldset>
                  {engagementAvailable && <fieldset id="aktivitaetsmessung" tabIndex={-1} className={styles.group}>
                    <legend>Aktivitätsmessung</legend>
                    <label className={styles.check}><input type="checkbox" checked={preferences.engagementTracking} aria-describedby="aktivitaetsmessung-hinweis" onChange={event => updatePreferences({ engagementTracking: event.target.checked })} />Aktive Zeit für Engagement-EP messen</label>
                    <small id="aktivitaetsmessung-hinweis">In der geschlossenen Alpha ist die Messung standardmäßig an. Sie zeigt dir deinen Fortschritt bei der Vorbereitung auf den Spielabend. Bestätigte Figurnotizen können zu Engagement-EP beitragen. Du kannst die Messung hier abschalten und mit „Profil speichern“ beenden. Deine bisherigen EP bleiben erhalten.</small>
                    <small><a href="/datenschutz#engagement">Mehr zur Aktivitätsmessung</a></small>
                  </fieldset>}
                </fieldset>
              </section>

              <div className={styles.saveBar}>
                {error ? <span role="alert" className={styles.saveError}>{error}</span> :
                  <span role="status">{notice || (hasChanges ? "Ungespeicherte Änderungen" : "Gespeicherter Stand")}</span>}
                <button className={styles.primary} type="submit" disabled={busy || !hasChanges}>{busy ? "Bitte warten." : "Profil speichern"}</button>
              </div>
            </form>

            <div id="sicherheit" tabIndex={-1} className={styles.security} hidden={active !== "sicherheit"}>
              <section className={styles.card} aria-labelledby="sessions-title">
                <div className={styles.heading}>
                  <h2 id="sessions-title">Aktive Sitzungen</h2>
                  <p>Hier siehst du, wann deine Anmeldungen zuletzt genutzt wurden.</p>
                </div>
                {sessionError && <p role="alert" className={styles.error}>{sessionError}</p>}
                {!sessions && !sessionError && <p role="status" className={styles.empty}>Deine Sitzungen werden geladen.</p>}
                {sessions?.map(session => <article className={styles.row} key={session.id}>
                  <div><strong>{session.current ? "Diese Sitzung" : "Weitere Sitzung"}</strong>
                    <small>Zuletzt aktiv {date(session.lastSeenAt)} · läuft bis {date(session.expiresAt)}</small>
                  </div>
                  <button type="button" disabled={busy} aria-label={session.current ? "Diese Sitzung abmelden" : "Sitzung vom " + date(session.lastSeenAt) + " abmelden"} onClick={() => void revoke(session.id)}>Abmelden</button>
                </article>)}
                {sessions?.some(session => !session.current) && <button className={styles.sessionAction} type="button" disabled={busy} onClick={() => void revoke()}>Andere Geräte abmelden</button>}
              </section>
              <section className={styles.card} aria-labelledby="password-title">
                <div className={styles.heading}>
                  <h2 id="password-title">Passwort ändern</h2>
                  <p>Nach der Änderung wirst du auf allen Geräten abgemeldet.</p>
                </div>
                <form onSubmit={password}>
                  <fieldset className={styles.fields} disabled={busy}>
                    <label>Aktuelles Passwort<input name="currentPassword" type="password" required maxLength={200} autoComplete="current-password" /></label>
                    <div className={styles.inputPair}>
                      <label>Neues Passwort<input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /></label>
                      <label>Neues Passwort wiederholen<input name="confirmation" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /></label>
                    </div>
                    <small>Verwende 12 bis 200 Zeichen.</small>
                    <button className={styles.primary} disabled={busy}>Passwort ändern und abmelden</button>
                  </fieldset>
                </form>
                <p className={styles.recovery}><a href="/passwort-zuruecksetzen">Passwort vergessen?</a></p>
              </section>
            </div>

            <div id="feedback" tabIndex={-1} hidden={active !== "feedback"}>
              <FeedbackSection />
            </div>
          </>}
        </div>
      </div>
    </div>
  </main>;
}
