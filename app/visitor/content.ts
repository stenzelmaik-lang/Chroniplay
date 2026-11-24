export const visitorContent = {
  title: "ChroniPlay",
  system: "Eine gemeinsame Chronik voller Geschichten.",
  intro: "Die Plattform für Pen-&-Paper-Kampagnen, Spielwelten und gemeinsame Geschichten.",
  heroImage: "/images/chroniplay-hero-background.png",
  cityImage: "/images/chronik-von-kleve-banner.png",
  sections: [
    {
      label: "Kampagnen",
      title: "Geschichten, die weiterleben.",
      text: "Die Chronik von Kleve verbindet Orte, Handouts und gemeinsame Geschichten in einem geschützten Spielbereich.",
    },
    {
      label: "Charaktere & Inventar",
      title: "Alles für deine Runde.",
      text: "Charaktere, Handouts und Inventar bleiben übersichtlich und im richtigen Moment griffbereit.",
    },
    {
      label: "Orte & Karten",
      title: "Die Welt wird begehbar.",
      text: "Interaktive Orte, Karten und Beziehungen verbinden deine Spielabende zu einer lebendigen Chronik.",
    },
  ],
  previewItems: [
    "Geschlossene Alpha",
    "Spielbereich für freigegebene Runden",
    "Erste Kampagne: Chronik von Kleve",
  ],
  status: {
    kicker: "Entwicklungsstand",
    title: "ChroniPlay wird gebaut – und schon gespielt.",
    text: "Seit Oktober 2026 läuft die geschlossene Alpha: Unsere erste Runde spielt die Chronik von Kleve direkt auf ChroniPlay. Mit Alpha 2.0 kamen im November unter anderem nachvollziehbare Erfahrungspunkte, die Wahl des MVP am Spielabend und ein Storyboard für Spielleitungen dazu.",
    action: "Zum Entwicklertagebuch",
    actionHref: "https://github.com/stenzelmaik-lang/Chroniplay/discussions/categories/entwicklertagebuch",
    // erreicht: abgeschlossen bzw. laufend (goldene Markierung)
    steps: [
      { title: "Konzept", state: "Abgeschlossen", erreicht: true },
      { title: "Geschlossene Alpha", state: "Seit Oktober 2026", erreicht: true },
      { title: "Alpha 2.0", state: "Aktuell · November 2026", erreicht: true },
      { title: "Weitere Runden & Kampagnen", state: "In Planung", erreicht: false },
    ],
  },
  faq: {
    kicker: "FAQ",
    title: "Häufige Fragen",
    intro: "Die wichtigsten Antworten – ganz ohne Anmeldung. Deine Frage ist nicht dabei? Frag uns im Discord.",
    items: [
      { q: "Was ist ChroniPlay?", a: "ChroniPlay ist eine Plattform für Pen-&-Paper-Rollenspiele. Spielleitungen bereiten hier ihre Spielabende vor, Spieler verwalten Charaktere, Notizen und Inventar, und am digitalen Spieltisch kommen Karten, Handouts und Würfel zusammen." },
      { q: "Kann ich mich schon registrieren?", a: "Noch nicht. ChroniPlay befindet sich in der geschlossenen Alpha. Eine öffentliche Registrierung gibt es derzeit nicht – Konten entstehen nur über eine persönliche Einladung." },
      { q: "Wie bekomme ich eine Einladung?", a: "Einladungen erstellt die Spielleitung einer Runde, die bereits auf ChroniPlay spielt. Der Link gilt nur für dich und nur einmal. Du möchtest dabei sein oder mehr erfahren? Schau in unserem Discord vorbei.", links: [{ label: "Discord beitreten", href: "https://discord.gg/y3n5JETXv3" }] },
      { q: "Welche Spielsysteme werden unterstützt?", a: "Unsere erste Kampagne, die Chronik von Kleve, spielt in Vampire: The Masquerade (V20). ChroniPlay ist modular aufgebaut – weitere Kampagnen und Systeme sind in Planung." },
      { q: "Kann ich eigene Runden und Kampagnen anlegen?", a: "Das ist das Ziel. Aktuell läuft die erste Kampagne; weitere Runden folgen Schritt für Schritt." },
      { q: "Kostet ChroniPlay etwas?", a: "Während der geschlossenen Alpha ist ChroniPlay kostenlos. Wie es später weitergeht, entscheiden wir, wenn es so weit ist." },
      { q: "Brauche ich eine App?", a: "Nein. ChroniPlay läuft im Browser – ohne Installation." },
      { q: "Was passiert mit meinen Daten?", a: "Kampagnen liegen in einem geschützten Spielbereich, den nur freigegebene Konten sehen. Inhalte der Spielleitung bleiben für Spieler verborgen. ChroniPlay läuft bei Cloudflare. Einzelheiten, etwa zur abschaltbaren Aktivitätsmessung, stehen in der Datenschutzerklärung.", links: [{ label: "Zur Datenschutzerklärung", href: "/datenschutz" }] },
      { q: "Ich habe mein Passwort vergessen. Was nun?", a: "Wende dich über den dir bekannten vertraulichen Kontaktweg an die Projektleitung. Nach einer Prüfung erhältst du einen Link zum Zurücksetzen, der 30 Minuten gültig ist. Bitte verschicke niemals Passwörter im Chat." },
      { q: "Wo erfahre ich, was es Neues gibt?", a: "Im Entwicklertagebuch auf GitHub berichten wir regelmäßig über neue Funktionen. Kurze Updates erscheinen im Discord im Kanal #chroniplay-updates – dafür in #start-hier die Rolle ChroniPlay oder ChroniPlay-News wählen.", links: [{ label: "Entwicklertagebuch", href: "https://github.com/stenzelmaik-lang/Chroniplay/discussions/categories/entwicklertagebuch" }, { label: "Discord", href: "https://discord.gg/y3n5JETXv3" }] },
      { q: "Wie kann ich Feedback geben oder Fehler melden?", a: "Als Alpha-Spieler meldest du Fehler am besten direkt deiner Spielleitung – mit Seite, Zeitpunkt, deinen Schritten und einem Screenshot ohne Passwörter. Ideen und Wünsche sind im Discord im Forum #website-entwicklung willkommen." },
      { q: "Wer steckt hinter ChroniPlay?", a: "ChroniPlay wird von pan0ram entwickelt – Gamer, Streamer und leidenschaftlicher Weltenbauer. Seine Community trifft sich in der Weltenrast auf Discord." },
    ] as { q: string; a: string; links?: { label: string; href: string }[] }[],
  },
  community: {
    kicker: "Community",
    title: "Komm ans Lagerfeuer.",
    intro: "ChroniPlay entsteht nicht im stillen Kämmerlein. Auf dem Discord-Server von pan0ram triffst du Spieler, Spielleitungen und das Entwicklungsteam – und auf GitHub kannst du jeden Schritt mitverfolgen.",
    discord: {
      title: "Discord: Die Weltenrast",
      text: "Neuigkeiten zu ChroniPlay, Austausch rund um Pen & Paper und dein Feedback direkt an das Team. Am Waldrand wartet schon ein Platz auf dich.",
      action: "Discord beitreten",
      // Dauerhafte Einladung (läuft nicht ab), Ziel: #am-waldrand
      href: "https://discord.gg/y3n5JETXv3",
    },
    github: {
      title: "Offen entwickelt auf GitHub",
      text: "Der Code von ChroniPlay ist öffentlich einsehbar. Im Entwicklertagebuch erzählen wir regelmäßig, was neu ist und woran wir gerade arbeiten.",
      diaryAction: "Zum Entwicklertagebuch",
      diaryHref: "https://github.com/stenzelmaik-lang/Chroniplay/discussions/categories/entwicklertagebuch",
      repoAction: "Projekt auf GitHub",
      repoHref: "https://github.com/stenzelmaik-lang/Chroniplay",
    },
  },
};

export type VisitorContent = typeof visitorContent;
