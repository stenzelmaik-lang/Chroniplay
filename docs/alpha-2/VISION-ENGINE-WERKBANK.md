# Regie-Werkbank für Visionen (Schritt 6)

- **Branch:** `claude/2.5-vision-werkbank`, gemergt als PR #114 (`5ab984c` auf `main`)
- **Basis:** `1b4bbe9` (2.5.5, Vision Engine)
- **Datum:** 25.11.2026
- Vorgeschichte: [VISION-ENGINE-PROTOTYP.md](VISION-ENGINE-PROTOTYP.md), [VISION-ENGINE-INTEGRATION.md](VISION-ENGINE-INTEGRATION.md)

## Was sich ändert

Visionen mit Regiespur bearbeitet die SL jetzt in einer Werkbank wie im Prototyp, statt im kompakten Regie-Editor aus 2.5.5:

- **Links, Ablauf:** Eintauchen, Bildmomente und Abschluss als eigene Schritte. Bildmomente mit Vorschaubild, Text, Chips (Nachhall, Platz · Größe, Dauer), Umsortieren per Ziehen oder Pfeil. Darunter Upload und die getrennte Galerie („Bild verwenden“).
- **Mitte, Live-Bühne:** dieselbe Engine wie beim Spieler, im echten Format (Desktop 1440×810, Tablet 1024×768, Handy 390×844) verkleinert dargestellt, mitlaufend beim Scrollen. Abspielen, Von vorn, Weiter, Zeitleiste mit Bildabschnitten und Lichtimpuls-Markierung, Effekte ruhiger, Ton an oder aus. Stumm voreingestellt, nichts wird zugestellt.
- **Rechts, Einstellungen:** Visionstyp als Karten mit Beschreibung der Effektsprache, Tempo, Intensität, Farbfilter; Moment-Inspektor (Brennpunkt mit Kernkreis, Kernbereich, Größe, Platz, Text mit Zeichen, Lesezeit und Sichtdauer, Nachhall mit Hinweis, Mindesthaltezeit, Herausnehmen mit Rückfrage); Ton mit Upload; interne Notiz; Prüfung mit Lesbarkeitsmessung.
- **Oben:** „Als Spieler ansehen“ öffnet die volle Vorschau mit Ton.
- Visionen ohne Regiespur sehen unverändert die bisherige Ansicht mit „Regie einrichten“.

## Technik

- `app/spielbereich/modules/vision-workbench.tsx` und `.module.css` ersetzen `vision-direction-editor.*`.
- Die eigenen Schaltflächen und Felder der Werkbank sind gegen die allgemeinen Editor-Regeln (`.editor header button`, `.preparation button`) abgesichert; sonst wurde „Als Spieler ansehen“ zum kleinen roten Löschsymbol.
- Engine: `renderAt(t)` zeichnet einen Zeitpunkt sofort. Die Lesbarkeitsprüfung hängt dadurch nicht mehr am nächsten Animationsbild (vorher wurde bei gedrosseltem Browser nur ein Text gemessen).
- Keine Datenänderung, kein neues Feld, keine Migration.

## Prüfungen (lokal, synthetische Konten)

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | 0 Fehler |
| ESLint (Werkbank, Schritt 6, Engine-Player) | sauber |
| `pnpm test` / alle Unit-Tests | 704/704 / 815/815 |
| Build | erfolgreich |
| Browser 1600×1000 | Werkbank erscheint für die Vision mit Regie; Moment wählen springt die Bühne an; Visionstyp wechselt die Live-Bühne (dunkel ↔ Echo); Umsortieren hin und zurück; Format Handy; „Als Spieler ansehen“ mit Vorschauhinweis öffnet und schließt |
| Lesbarkeit (7 Texte, Erinnerungsecho) | Desktop mindestens 10,1:1, Handy mindestens 13:1 |

## Grenzen

- Nicht auf Produktion mit echten Konten geprüft, nicht auf kleinen Laptop-Bildschirmen unter 1280 px Breite angesehen (dort rücken die Einstellungen unter Ablauf und Bühne).
- Die Live-Bühne öffnet einen zweiten WebGL-Kontext neben der vollen Vorschau.
- Spontane Visionen im Regie-Komponisten der Live-Regie haben weiterhin keine Regie-Felder.
