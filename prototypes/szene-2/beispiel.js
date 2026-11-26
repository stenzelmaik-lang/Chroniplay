// Szene 2.0 – neutrales Beispiel für den klickbaren Entwurf. Frei erfunden, keine Kampagnendaten.
// Liegt eine Datei `referenzfall.local.js` daneben (nicht im Repo), nutzt der Entwurf stattdessen diese.
window.SZENE_DATEN = window.SZENE_DATEN || {
  quelle: 'Neutrales Beispiel',
  pfad: ['Chronik', 'Buch: Die stille Flut', 'Spielabend 03', 'Szene 04'],
  titel: 'Die Stimme im Leuchtturm',
  typ: 'Begegnung', status: 'In Ausarbeitung', dauer: 45,
  ueberblick: {
    situation: 'Die Gruppe erreicht nachts den verlassenen Leuchtturm. Oben brennt Licht, obwohl niemand dort sein dürfte.',
    zweck: 'Die Wärterin Mara kennenlernen und herausfinden, warum das Leuchtfeuer wieder brennt.',
    voraussetzungen: 'Die Gruppe hat den Hinweis auf den Leuchtturm erhalten (Szene 02).',
    einstiege: ['Über den Küstenpfad', 'Mit dem Boot über die Bucht'],
    grundton: 'Einsam, rätselhaft, leise bedrohlich',
    ende: 'offen',
  },
  abschnitte: [
    { id: 'a1', titel: 'Der Küstenpfad', text: 'Der Wind trägt Salz und den Geruch von Tang. Vor euch ragt der Leuchtturm in den Himmel, sein Licht kreist langsam über das schwarze Wasser.', regie: 'Langsam lesen. Möwenrufe im Hintergrund.', stimmung: 's1' },
    { id: 'a2', titel: 'Die Tür', text: 'Die schwere Holztür steht einen Spalt offen. Dahinter windet sich eine Wendeltreppe nach oben.', regie: 'Pause vor dem letzten Satz.', stimmung: null },
    { id: 'a3', titel: 'Die Laterne', text: 'Oben sitzt eine alte Frau neben der Laterne und summt ein Lied, das ihr nicht kennt. Sie dreht sich nicht um.', regie: 'Erst nach der Beschreibung Mara sprechen lassen.', stimmung: 's2' },
  ],
  stimmungen: [
    { id: 's1', name: 'Küste bei Nacht', bild: 'Leuchtturm von außen', ton: 'Wind und Brandung (Schleife)', effekte: ['Nebel'], standard: true },
    { id: 's2', name: 'Laternenraum', bild: 'Laternenraum, warmes Licht', ton: 'Summen, Knistern', effekte: [], standard: false },
  ],
  beteiligte: [
    { id: 'n1', name: 'Mara Lind', bild: 'Alte Frau mit Wollschal', warum: 'Sie wacht seit dem Unglück über das Leuchtfeuer.', will: 'Dass das Licht nie wieder ausgeht.', weiss: 'Wer das Schiff damals auf die Klippen gelockt hat.', verschweigt: 'Dass sie selbst das Licht gelöscht hatte.', reaktion: 'Freundlichkeit öffnet sie, Druck lässt sie verstummen.', eingreifen: '–', geht: 'Wenn jemand die Laterne berührt.', karte: 'Eine alte Frau neben der Laterne. Sie summt ein Lied, das niemand kennt.', saetze: ['„Das Licht muss brennen. Immer.“', '„Ihr seid nicht die Ersten, die fragen.“'] },
  ],
  schauplaetze: [
    { id: 'p1', name: 'Leuchtturm · Außen', notiz: 'Klippe, schmaler Pfad, Bootssteg unten' },
    { id: 'p2', name: 'Leuchtturm · Laternenraum', notiz: 'Laterne brennt, Logbuch auf dem Tisch' },
  ],
  material: [
    { id: 'm1', name: 'Logbuch des Leuchtturms', art: 'Akte', wie: 'search', bedingung: 'Wenn jemand den Tisch untersucht.', von: null, inSzenen: 2 },
    { id: 'm2', name: 'Foto des Schiffs', art: 'Bild', wie: 'handover', bedingung: 'Mara zeigt es, wenn sie Vertrauen fasst.', von: 'n1', inSzenen: 1, einsteckbar: true },
    { id: 'm3', name: 'Seekarte der Bucht', art: 'Karte', wie: 'open', bedingung: 'Liegt offen an der Wand.', von: null, inSzenen: 3 },
  ],
  interaktionen: [
    { id: 'i1', wenn: 'Die Spieler untersuchen den Tisch', dann: 'Sie finden das Logbuch; die letzte Seite ist herausgerissen.', material: ['m1'], erkenntnisse: ['e2'], proben: ['p-such'], ereignisse: [] },
    { id: 'i2', wenn: 'Jemand berührt die Laterne', dann: 'Mara schreit auf, das Licht flackert.', material: [], erkenntnisse: [], proben: [], ereignisse: ['ev1'] },
  ],
  proben: [
    { id: 'p-such', titel: 'Tisch durchsuchen', werte: 'Wahrnehmung + Nachforschung', sg: '6', folgen: { erfolg: 'Die herausgerissene Seite fällt auf.', misserfolg: 'Nur das Logbuch selbst.', patzer: 'Das Logbuch fällt ins Treppenhaus.' }, hinweis: 'Nur würfeln, wenn gezielt gesucht wird.' },
    { id: 'p-vertr', titel: 'Maras Vertrauen gewinnen', werte: 'Charisma + Empathie', sg: '7', folgen: { erfolg: 'Sie zeigt das Foto.', misserfolg: 'Sie summt weiter.', patzer: 'Sie verlangt, dass ihr geht.' }, hinweis: '' },
  ],
  erkenntnisse: [
    { id: 'e1', titel: 'Das Licht brennt wieder', stufe: 'known', fund: 'Von Anfang an sichtbar.', akte: null },
    { id: 'e2', titel: 'Die letzte Logbuchseite fehlt', stufe: 'discoverable', fund: 'Tisch untersuchen.', akte: 'Hinweis: Logbuch' },
    { id: 'e3', titel: 'Mara löschte damals das Licht', stufe: 'gm', fund: 'Nur SL-Wissen; offenbart sich höchstens im Gespräch.', akte: null },
  ],
  visionen: [
    { id: 'v1', titel: 'Das sinkende Schiff', bilder: 3, bedingung: 'Nur bei Berührung der Laterne, nur eine Person.', empfaenger: 'einzeln' },
  ],
  ereignisse: [
    { id: 'ev1', titel: 'Das Licht erlischt', ausloeser: 'Laterne berührt oder Mara verlässt den Raum.', wirkung: 'Dunkelheit; draußen läuft ein Boot auf.', timer: null },
    { id: 'ev2', titel: 'Die Flut kommt', ausloeser: 'Nach 30 Minuten Spielzeit am Leuchtturm.', wirkung: 'Der Pfad ist abgeschnitten.', timer: 30 },
  ],
  notizen: [
    { id: 'no1', art: 'Offene Frage', text: 'Wer war auf dem Boot?', bezug: 'Szene' },
    { id: 'no2', art: 'Erinnerung', text: 'Maras Lied später wieder aufgreifen.', bezug: 'Kampagne' },
  ],
  ausgaenge: [
    { id: 'x1', ziel: 'Szene 05 – Die Bucht', art: 'Weiter', bedingung: 'Wenn sie dem Boot folgen' },
    { id: 'x2', ziel: 'Szene 06 – Das Dorf', art: 'Alternative', bedingung: 'Wenn sie Mara mitnehmen' },
  ],
  bibliothek: {
    npc: ['Mara Lind', 'Hafenmeister Olsen', 'Die Fremde im grauen Mantel'],
    orte: ['Leuchtturm · Außen', 'Leuchtturm · Treppe', 'Leuchtturm · Laternenraum', 'Hafen', 'Dorfkirche'],
    material: ['Logbuch des Leuchtturms', 'Foto des Schiffs', 'Seekarte der Bucht', 'Brief der Reederei', 'Zeitungsausschnitt 1923'],
    akten: ['Hinweis: Logbuch', 'Hinweis: Das Wrack', 'Handout: Reederei'],
  },
};
