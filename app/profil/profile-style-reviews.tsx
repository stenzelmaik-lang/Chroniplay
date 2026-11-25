"use client";

import { useState } from "react";
import type { StyleReviewStatus } from "@/domain/player-profile";
import { accountApi } from "./account-ui";
import styles from "./profile.module.css";

type Review = { memberId: string; name: string; style: string; status: StyleReviewStatus };
type Decision = Exclude<StyleReviewStatus, "pending">;
const endpoint = "/api/profile/style-reviews";
const labels: Record<StyleReviewStatus, string> = {
  pending: "In Prüfung", approved: "Freigegeben", blocked: "Gesperrt",
};

export function ProfileStyleReviews() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const next = await accountApi<{ reviews: Review[] }>(endpoint);
    setReviews(next.reviews);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(review: Review, decision: Decision) {
    await run(async () => {
      await accountApi(endpoint, "PATCH", { memberId: review.memberId, style: review.style, decision });
      setReviews(current => current?.map(item => item.memberId === review.memberId && item.style === review.style
        ? { ...item, status: decision } : item) ?? null);
      setNotice(decision === "approved" ? "Spielstil freigegeben." : "Spielstil für diese Runde gesperrt.");
    });
  }

  const ordered = reviews ? [...reviews].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")) : [];
  return <details className={styles.card + " " + styles.reviewSection} onToggle={event => {
    if (event.currentTarget.open && !busy) void run(load);
  }}>
    <summary>Eigene Spielstile prüfen</summary>
    <p>Prüfe die eingereichten Angaben für diese Kampagne. Sperre Beleidigungen, Diskriminierung, Belästigung und menschenverachtende Inhalte.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    <button type="button" disabled={busy} onClick={() => void run(load)}>Liste aktualisieren</button>
    {busy && !reviews && <p role="status">Spielstile werden geladen.</p>}
    {reviews?.length === 0 && <p>Für diese Kampagne liegen keine eigenen Spielstile vor.</p>}
    {ordered.map(review => <div className={styles.row} key={JSON.stringify([review.memberId, review.style])}>
      <div><strong>{review.style}</strong><small>{review.name} · {labels[review.status]}</small></div>
      <div className={styles.reviewActions}>
        <button type="button" disabled={busy || review.status === "approved"} onClick={() => void decide(review, "approved")}>Freigeben</button>
        <button type="button" disabled={busy || review.status === "blocked"} onClick={() => void decide(review, "blocked")}>Sperren</button>
      </div>
    </div>)}
  </details>;
}
