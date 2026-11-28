"use client";
// Öffentliche Welt: what guests see is chosen in one central list (Rückblicke & Chronik → Website), not per editor.
import { Globe } from "lucide-react";
import styles from "./website-release.module.css";

export function WebsiteHint() {
  return <p className={styles.hint}><Globe size={14} aria-hidden="true" />Website: Auswahl unter <a href="/sl/command-center?bereich=rueckblick&ansicht=website">Rückblicke &amp; Chronik → Website</a>.</p>;
}
