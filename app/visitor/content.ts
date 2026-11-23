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
      diaryHref: "https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/categories/entwicklertagebuch",
      repoAction: "Projekt auf GitHub",
      repoHref: "https://github.com/stenzelmaik-lang/chronik-von-kleve",
    },
  },
};

export type VisitorContent = typeof visitorContent;
