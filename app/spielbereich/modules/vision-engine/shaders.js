/**
 * GLSL-Shader der Vision Engine (WebGL2 / GLSL ES 3.00).
 *
 * Durchgänge pro Bild:
 *  1. Nebel (halbe Auflösung): mehrschichtiger, domänenverzerrter Nebel, Lichtkegel mit Strahlen, Vordergrunddichte im Alpha.
 *  2. Komposition (volle Auflösung): zwei Bildebenen mit organischer Maske, Entstehung und Auflösung je Visionstyp,
 *     Farbfilter, Vordergrundnebel, unsichtbarer Kontrastschleier hinter den Worten, Vignette, Filmkorn, Dithering.
 *  3. Partikel: GPU-Punkte, deren Bahn vollständig im Vertex-Shader berechnet wird (keine CPU-Last pro Partikel).
 *
 * Grundsatz: Das Standbild selbst bewegt sich nie. Verzerrung, Farbversatz und Doppelkontur wirken nur
 * während Entstehung und Auflösung und nur im äußeren Randbereich der Maske, nie im geschützten Kern.
 */

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** Einmalig: kachelbare Gradientenrausch-Textur mit vier unabhängigen Kanälen (256×256). Spart Rechenzeit in jedem Bild. */
export const NOISE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uPeriod;
vec2 grad2(vec2 cell, float seed) {
  cell = mod(cell, uPeriod);
  vec3 p3 = fract(vec3(cell.xyx) * vec3(0.1031, 0.1030, 0.0973) + seed);
  p3 += dot(p3, p3.yzx + 33.33);
  vec2 h = fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
  return h / max(length(h), 1e-4);
}
float gnoise(vec2 p, float seed) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad2(i, seed), f);
  float b = dot(grad2(i + vec2(1.0, 0.0), seed), f - vec2(1.0, 0.0));
  float c = dot(grad2(i + vec2(0.0, 1.0), seed), f - vec2(0.0, 1.0));
  float d = dot(grad2(i + vec2(1.0, 1.0), seed), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  vec2 p = vUv * uPeriod;
  outColor = vec4(gnoise(p, 0.13), gnoise(p, 0.37), gnoise(p, 0.71), gnoise(p, 0.93)) * 0.7 + 0.5;
}`;

export const FOG_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uNoise;
uniform float uTime, uAspect, uOctaves, uPresence;
uniform vec3 uBgTop, uBgBottom, uFogA, uFogB, uLightCol;
uniform vec4 uFogP;   // Dichte, Vordergrund, Maßstab, Verwirbelung
uniform vec4 uFlowP;  // Strömung xy, Bodennebel, verschlucktes Licht
uniform vec4 uLightP; // Lichtquelle xy (Bühnen-UV), Kegelbreite, Strahlen
uniform vec4 uLightQ; // Richtung xy, Intensität inkl. Impuls, Schattenranken
uniform vec4 uOpen0;  // Brennpunkt xy (UV), Radius (Bühnenhöhen), Stärke: der Nebel öffnet sich für das Bild
uniform vec4 uOpen1;

float fbm(vec2 p, float oct) {
  float s = 0.0, a = 0.5, w = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= oct) break;
    s += a * texture(uNoise, p).r;
    w += a;
    p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03 + vec2(0.137, 0.731);
    a *= 0.46; // feine Oktaven leise: weicher Nebel statt Krümelstruktur
  }
  return (s / w - 0.5) * 1.55 + 0.5;
}
float openMask(vec2 p, vec4 o) {
  if (o.w <= 0.0) return 1.0;
  float d = length(p - vec2(o.x * uAspect, o.y));
  return 1.0 - o.w * (1.0 - smoothstep(o.z * 0.5, o.z * 1.3, d));
}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float t = uTime;
  vec2 flow = uFlowP.xy;
  vec2 sp = p * uFogP.z;
  float o3 = min(uOctaves, 3.0);
  // Eine zentrierte Verwirbelungsebene: Schwaden entwickeln sich, statt nur zu wandern (ohne Marmormuster)
  vec2 q = vec2(fbm(sp * 0.16 + flow * t * 0.7, o3), fbm(sp * 0.16 + vec2(5.2, 1.3) - flow.yx * t * 0.5, o3)) - 0.5;
  vec2 r = q;
  float d1 = fbm(sp * 0.2 + q * uFogP.w * 0.55 + flow * t, uOctaves);
  float d2 = fbm(sp * 0.42 + q * uFogP.w * 0.35 - flow * t * 1.7 + vec2(3.1, 7.7), max(uOctaves - 1.0, 2.0));
  // großräumiges Atmen: Schwaden verdichten und lichten sich langsam
  float breathe = smoothstep(0.25, 0.75, texture(uNoise, p * 0.07 + vec2(t * 0.0021, -t * 0.0013)).g);

  vec3 col = mix(uBgBottom, uBgTop, smoothstep(0.0, 1.0, vUv.y));
  float low = 1.0 + uFlowP.z * 1.2 * (1.0 - smoothstep(0.0, 0.55, vUv.y));
  float open = openMask(p, uOpen0) * openMask(p, uOpen1);
  float dens1 = smoothstep(0.2, 0.95, d1) * uFogP.x * low * mix(0.45, 1.0, open) * mix(0.6, 1.15, breathe);
  float dens2 = smoothstep(0.32, 0.95, d2) * uFogP.x * 0.65 * low * mix(0.3, 1.0, open) * mix(1.1, 0.7, breathe);

  // Licht: Kegel mit feinen Strahlen, die durch die Schwaden scheinen
  vec2 lp = vec2(uLightP.x * uAspect, uLightP.y);
  vec2 lv = p - lp;
  float ld = length(lv) + 1e-4;
  vec2 dirv = lv / ld;
  float cone = smoothstep(1.0 - uLightP.z, 1.0, dot(dirv, normalize(uLightQ.xy)));
  float streak = smoothstep(0.3, 0.85, texture(uNoise, dirv * 2.2 + vec2(t * 0.004, 0.0)).g);
  // weiches Nahfeld: kein Sternenkranz an der Lichtquelle, die Strahlen erscheinen erst im Nebel
  float atten = smoothstep(0.08, 0.55, ld) / (1.0 + ld * ld * 1.6);
  float li = uLightQ.z;
  vec3 fogCol = mix(uFogB, uFogA, smoothstep(0.15, 0.95, d1));
  float lit = 0.35 + 0.9 * cone * atten * li;
  float dark = uFlowP.w;
  col += fogCol * (dens1 + dens2 * 0.55) * lit * (1.0 - dark);
  col += fogCol * lit * 1.7 * dark * (1.0 - clamp(dens1 * 1.5 + dens2 * 0.5, 0.0, 1.0)) * mix(0.5, 1.0, breathe);
  col = mix(col, col * 0.12, dark * clamp(dens1 + dens2 * 0.6, 0.0, 1.0));
  col += uLightCol * cone * atten * li * uLightP.w * (0.25 + 0.75 * streak) * (0.3 + dens1 * 0.9);

  // Vordergrunddichte: schneller, feiner, dünnt um den Bildkern aus
  float df = fbm(sp * 0.55 + r * 0.5 + vec2(t * 0.018, -t * 0.005) + flow * t * 2.4, max(uOctaves - 1.0, 2.0));
  float front = smoothstep(0.42, 0.95, df) * uFogP.y * low * mix(0.3, 1.0, open);

  // Unruhige Schatten vom Rand (bedrohliche Vision)
  if (uLightQ.w > 0.0) {
    vec2 c = vUv - 0.5;
    float lc = length(c * vec2(1.0, 1.3));
    float edge = smoothstep(0.2, 0.62, lc);
    float tn = fbm(normalize(c + 1e-4) * 1.3 + vec2(lc * 2.4 - t * 0.08) + q * 0.6, 3.0);
    float tendril = smoothstep(0.5, 0.66, tn) * edge;
    front = max(front, tendril * uLightQ.w);
    col *= 1.0 - tendril * uLightQ.w * 0.6;
  }
  outColor = vec4(col * uPresence, clamp(front, 0.0, 1.0) * uPresence);
}`;

export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFog, uNoise, uImg0, uImg1;
uniform vec2 uRes;
uniform float uTime, uMaster, uLod0, uLod1;
uniform vec2 uCore;             // Radius des geschützten Kerns je Ebene (Pixel)
uniform vec4 uRect0, uRect1;   // Bild-Rechteck in Pixeln (x0, y0, Breite, Höhe), y nach oben
uniform vec4 uMask0, uMask1;   // Brennpunkt xy, innerer Radius, äußerer Radius (Pixel)
uniform vec4 uState0, uState1; // Entstehung, Auflösung, Lichtimpuls, Übergangsaktivität
uniform vec4 uShape;           // Ellipsenbreite, Randrauschen, Fragmentlöcher, Atmen der Kontur
uniform vec4 uFx;              // Lichtbrechung, Farbversatz, Doppelkontur, Farbfilterstärke
uniform vec4 uGrade;           // Sättigung, Kontrast, Anhebung, Kantenleuchten (negativ: Rauchkante)
uniform vec3 uTintS, uTintH, uGlow, uFront, uLightCol;
uniform vec4 uPost;            // Filmkorn, Vignette, Projektorflackern, Steigerung
uniform vec4 uTextShade;       // Mitte xy, Radien xy (Pixel)
uniform float uTextShadeAmt, uFlashGlobal;
uniform int uRevealMode;
uniform vec4 uLightGlow;       // Lichtquelle UV, Intensität
uniform vec2 uSweepDir;
uniform vec4 uDiss;            // Auflösung: Bandbreite, Leuchten, Strömung

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float fbm3(vec2 p) {
  return texture(uNoise, p).r * 0.57 + texture(uNoise, p * 2.03 + vec2(0.3, 0.7)).r * 0.29 + texture(uNoise, p * 4.01 + vec2(0.8, 0.1)).r * 0.14;
}
vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 g = mix(vec3(l), c, uGrade.x);
  g = (g - 0.5) * uGrade.y + 0.5 + uGrade.z;
  g *= mix(uTintS, uTintH, smoothstep(0.08, 0.85, l));
  return mix(c, max(g, 0.0), uFx.w);
}

// Eine Bildebene, vormultipliziert. protect: wie stark der Vordergrundnebel hier zurückweicht (Kernschutz).
// Aufbau: 1 feste Wolkenkontur des Standbilds → 2 Entstehung → 3 Auflösung. Jeder Effekt bleibt innerhalb der Kontur,
// deshalb zeigt sich die rechteckige Bildgrenze nie, auch nicht im Leuchten.
vec4 layer(sampler2D img, float lod, vec4 R, vec4 M, vec4 S, float coreR, float seed, vec2 px, out float protect) {
  protect = 0.0;
  float reveal = S.x, diss = S.y, flash = S.z, trans = S.w;
  if (reveal <= 0.0005 || diss >= 0.9995 || R.z <= 0.0) return vec4(0.0);
  vec2 uv = (px - R.xy) / R.zw;
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return vec4(0.0);
  // Abstand zum Brennpunkt, gemessen an der Entfernung zur eigenen Bildkante in jeder Richtung:
  // 1 an der Bildgrenze, darüber in den Ecken. So läuft das Bild wie eine Wolke aus, bevor seine Kante erreicht ist.
  vec2 fuv = (M.xy - R.xy) / R.zw;
  vec2 d = uv - fuv;
  vec2 ext = max(vec2(d.x < 0.0 ? fuv.x : 1.0 - fuv.x, d.y < 0.0 ? fuv.y : 1.0 - fuv.y), vec2(0.1));
  float innerN = M.z;
  float dist = length(px - M.xy);
  vec2 np = px / uRes.y;
  // Kontur atmet langsam; das Bild selbst steht still
  float en = fbm3(np * 1.15 + vec2(seed * 3.7, seed * 1.3) + uTime * 0.010 * uShape.w) - 0.5;
  float en2 = texture(uNoise, np * 3.0 + seed * 1.9 - uTime * 0.004 * uShape.w).g - 0.5;
  float field = length(d / ext) + en * uShape.y * 1.4 + en2 * uShape.y * 0.18;

  // 1 · Wolkenkontur: organische Form, ausgefranste Bildgrenzen, Fehlstellen der Erinnerung.
  // Im geschützten Kern (wichtigster Bildbereich) läuft der Rand nur schmal aus, Fehlstellen gibt es dort nicht.
  float coreP = 1.0 - smoothstep(coreR * 0.8, coreR * 1.1, dist);
  float shape = max(1.0 - smoothstep(innerN, 1.0, field), coreP);
  vec2 eh = min(uv, 1.0 - uv) * vec2(R.z / R.w, 1.0);
  shape *= smoothstep(0.0, 0.08, min(eh.x, eh.y) + en * 0.08 + en2 * 0.03);
  if (uShape.z > 0.0) {
    float hn = fbm3(np * 2.2 + seed * 5.1 + uTime * 0.003);
    float hole = smoothstep(0.58 - uShape.z * 0.1, 0.7 - uShape.z * 0.1, hn) * smoothstep(max(innerN, 0.5), 0.95, field);
    shape *= 1.0 - clamp(hole * uShape.z * 1.3, 0.0, 0.85) * (1.0 - coreP);
  }
  if (shape <= 0.001) return vec4(0.0);
  vec2 suv0 = vec2(uv.x, 1.0 - uv.y);

  // 2 · Entstehung je Visionstyp
  float Rv;
  float sweepGlow = 0.0;
  if (uRevealMode == 2) {
    // aus der Finsternis: helle Bildteile zuerst
    float lum = dot(textureLod(img, suv0, lod + 1.0).rgb, vec3(0.2126, 0.7152, 0.0722));
    float th = 1.0 - reveal * 1.4;
    Rv = smoothstep(th, th + 0.35, lum + en * 0.25 + 0.18 * (1.0 - field));
  } else if (uRevealMode == 4) {
    // hinter einer wandernden Lichtfront
    vec2 rel = (px - R.xy) / R.w;
    float along = dot(rel, uSweepDir);
    float a = R.z / R.w;
    float c1 = uSweepDir.x * a, c2 = uSweepDir.y, c3 = c1 + c2;
    float lo = min(min(0.0, c1), min(c2, c3)), hi = max(max(0.0, c1), max(c2, c3));
    float pos = mix(lo - 0.35, hi + 0.35, reveal);
    float k = along + en * 0.3;
    Rv = 1.0 - smoothstep(pos - 0.3, pos, k);
    sweepGlow = exp(-pow((k - pos) / 0.1, 2.0)) * (1.0 - reveal);
  } else {
    // aus dem Nebel wie eine sich öffnende Wolke (fließend: mit seitlicher Strömung)
    float rr = mix(0.04, 1.0, reveal);
    float f2 = field + en * 0.5 * (1.0 - reveal);
    if (uRevealMode == 1) f2 += (en * 0.9 + 0.3 * (uv.x - 0.5)) * (1.0 - reveal);
    float band = max((1.0 - innerN) * rr, 0.16);
    Rv = 1.0 - smoothstep(rr - band, rr + 0.02, f2);
  }

  // 3 · Auflösung: wolkig von außen nach innen; Bandbreite, Leuchten und Strömung je Typ
  float keep = 1.0, glowEdge = 0.0;
  if (diss > 0.0) {
    float cloud = en * 1.25 + en2 * 0.55 + 0.5;
    float k = 0.7 * clamp(field, 0.0, 1.2) + 0.3 * cloud + uDiss.z * (uv.x - 0.5);
    float th = 1.22 - diss * 1.55;
    float bw = uDiss.x;
    keep = 1.0 - smoothstep(th - bw, th, k);
    glowEdge = (1.0 - smoothstep(0.0, bw * 1.4, abs(k - (th - bw * 0.5)))) * smoothstep(0.0, 0.06, diss);
  }
  float A = shape * Rv * keep;
  float frontGlow = reveal < 1.0 ? clamp(Rv * (1.0 - Rv) * 4.0, 0.0, 1.0) * (1.0 - reveal) : 0.0;
  if (uRevealMode == 3) frontGlow *= 2.0;
  // Leuchten nur im Inneren der Wolkenkontur, nie entlang der Bildgrenzen
  float glowMask = shape * smoothstep(0.0, 0.55, shape);
  glowEdge *= glowMask * Rv;
  frontGlow *= glowMask;
  sweepGlow *= glowMask;
  if (A <= 0.001 && glowEdge + frontGlow + sweepGlow <= 0.002) return vec4(0.0);

  // Verzerrung nur an der Übergangsfront im Außenbereich; der Kern bleibt unverfälscht
  float outerZone = smoothstep(innerN * 0.85, 1.0, field);
  float tw = trans * outerZone;
  vec2 suv = suv0;
  if (uFx.x > 0.0 && tw > 0.0) {
    vec2 g = vec2(texture(uNoise, np * 2.2 + uTime * 0.03).b, texture(uNoise, np * 2.2 + vec2(0.31, 0.77) - uTime * 0.03).a) - 0.5;
    suv += g * uFx.x * tw * 0.035;
  }
  vec3 c = textureLod(img, suv, lod).rgb;
  float ca = uFx.y * (tw * 0.0045 + flash * 0.006);
  if (ca > 0.0) {
    c.r = textureLod(img, suv + vec2(ca, 0.0), lod).r;
    c.b = textureLod(img, suv - vec2(ca, 0.0), lod).b;
  }
  float gh = uFx.z * trans * (0.35 + 0.65 * outerZone);
  if (gh > 0.0) {
    vec3 g2 = textureLod(img, suv0 + vec2(0.014, 0.006) * gh, lod).rgb;
    c = mix(c, max(c, g2), 0.38 * gh);
  }
  c = grade(c);
  c = c * (1.0 + flash * 0.5) + uGlow * flash * 0.1;
  float ga = uGrade.w;
  vec4 outv;
  if (ga >= 0.0) {
    float g = (glowEdge * uDiss.y * 1.6 + frontGlow * 0.5 + sweepGlow * 0.9) * ga;
    outv = vec4(c * A + uGlow * g, clamp(A + g * 0.5, 0.0, 1.0));
  } else {
    float smoke = clamp((glowEdge * uDiss.y + frontGlow * 0.5) * -ga, 0.0, 1.0);
    outv = vec4(c * A * (1.0 - smoke), clamp(max(A, smoke * 0.9), 0.0, 1.0));
  }
  protect = (1.0 - smoothstep(coreR * 0.75, coreR * 1.05, dist)) * A;
  return outv;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec4 fog = texture(uFog, vUv);
  vec3 col = fog.rgb;
  float p0, p1;
  vec4 L0 = layer(uImg0, uLod0, uRect0, uMask0, uState0, uCore.x, 0.37, px, p0);
  vec4 L1 = layer(uImg1, uLod1, uRect1, uMask1, uState1, uCore.y, 1.91, px, p1);
  col = col * (1.0 - L0.a) + L0.rgb;
  col = col * (1.0 - L1.a) + L1.rgb;
  float protect = max(p0, p1);
  // Vordergrundnebel, nahe der Lichtquelle aufgehellt; weicht über dem Bildkern zurück
  vec2 lq = (vUv - uLightGlow.xy) * vec2(uRes.x / uRes.y, 1.0);
  float near = exp(-dot(lq, lq) * 1.2);
  vec3 frontCol = uFront * (0.75 + 0.5 * near * uLightGlow.z);
  col = mix(col, frontCol, clamp(fog.a * (1.0 - protect * 0.9), 0.0, 1.0));
  col += uLightCol * near * uLightGlow.z * 0.05;
  // unsichtbarer Kontrastschleier hinter den Worten (kein Kasten, nur dunklere Atmosphäre)
  vec2 tq = (px - uTextShade.xy) / max(uTextShade.zw, vec2(1.0));
  col *= 1.0 - uTextShadeAmt * 0.6 * exp(-dot(tq, tq) * 1.15);
  col += uLightCol * uFlashGlobal * 0.06;
  vec2 vq = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= 1.0 - uPost.y * smoothstep(0.35, 1.05, length(vq));
  col *= 1.0 + uPost.z * (texture(uNoise, vec2(uTime * 0.23, 0.37)).r - 0.5) * 0.07;
  float gr = hash12(px + fract(uTime * 13.17) * vec2(417.0, 239.0)) - 0.5;
  col += gr * uPost.x * (0.6 + 0.4 * (1.0 - dot(col, vec3(0.333))));
  col += (hash12(px * 1.37 + fract(uTime) * 91.0) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0) * uMaster, 1.0);
}`;

export const PARTICLE_VERT = `#version 300 es
precision highp float;
in vec4 aSeed;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uTime, uDpr, uMaster, uBurstMode, uAspectX;
uniform int uKind;
uniform vec4 uP;        // Größe min, Größe max, Geschwindigkeit, Deckkraft
uniform vec4 uLightP;   // Lichtquelle UV, Kegelbreite, Strahlverstärkung
uniform vec2 uLightDir;
uniform vec4 uBurst;    // Brennpunkt (Pixel), Radius (Pixel), Fortschritt der Auflösung
out float vA;
out float vRing;
void main() {
  float t = uTime;
  vec4 s = aSeed;
  float size = mix(uP.x, uP.y, s.w * s.w);
  float a = uP.w;
  vRing = 0.0;
  if (uBurstMode > 0.5) {
    // Auflösungsstaub: entsteht an der nach innen wandernden Erosionsfront und steigt auf
    float prog = uBurst.w;
    float ang = s.x * 6.2831853;
    float rad = uBurst.z * (1.05 - prog * 0.95) * (0.55 + 0.6 * s.y);
    float life = fract(s.z + t * 0.22);
    vec2 pos = uBurst.xy + vec2(cos(ang) * uAspectX, sin(ang)) * rad + vec2((s.y - 0.5) * 30.0, 40.0 + 70.0 * s.w) * life * uDpr;
    a = sin(3.14159 * prog) * (1.0 - life) * 0.9;
    gl_Position = vec4(pos / uRes * 2.0 - 1.0, 0.0, 1.0);
    gl_PointSize = size * 1.2 * uDpr;
    vA = a * uMaster;
    return;
  }
  vec2 b = s.xy;
  float sp = uP.z * (0.4 + 0.9 * s.z);
  if (uKind == 0) {          // silberne Schwebeteilchen: steigen, wiegen sich
    b.y = fract(b.y + t * sp * 0.6);
    b.x += sin(t * 0.35 + s.z * 40.0) * 0.012;
  } else if (uKind == 1) {   // Traum: große unscharfe Lichtpunkte, seitliche Drift
    b.x = fract(b.x + t * sp * 0.5);
    b.y += sin(t * 0.22 + s.w * 20.0) * 0.03;
    vRing = 1.0;
  } else if (uKind == 2) {   // Asche fällt
    b.y = fract(b.y - t * sp * 0.7);
    b.x += sin(t * 0.6 + s.z * 30.0) * 0.02;
  } else if (uKind == 3) {   // Glut steigt unruhig von unten
    float life = fract(s.y + t * sp * 0.9);
    b.y = life * 1.15 - 0.08;
    vec2 n = textureLod(uNoise, vec2(s.x * 3.0, life * 0.8 - t * 0.05), 0.0).ba - 0.5;
    b.x = fract(s.x + n.x * 0.18 + life * 0.05);
    a *= smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.6, 1.0, life));
  } else if (uKind == 4) {   // Funkenstrom
    b = fract(b + vec2(-0.6, 0.25) * t * sp * 1.2);
  } else {                   // goldener Staub, Brownsche Bewegung
    vec2 n = textureLod(uNoise, s.xy * 0.7 + t * 0.004 * (0.5 + s.z), 0.0).ba - 0.5;
    b = fract(b + n * 0.35 + vec2(t * sp * 0.15, t * sp * 0.08));
  }
  a *= 0.55 + 0.45 * sin(t * (0.8 + s.z * 2.2) + s.w * 30.0);
  if (uLightP.w > 0.0) {
    vec2 lv = vec2((b.x - uLightP.x) * uRes.x / uRes.y, b.y - uLightP.y);
    float cone = smoothstep(1.0 - max(uLightP.z, 0.05), 1.0, dot(normalize(lv + 1e-4), normalize(uLightDir)));
    a *= mix(1.0, 0.25 + 2.2 * cone, uLightP.w);
  }
  a *= smoothstep(0.0, 0.06, b.x) * smoothstep(1.0, 0.94, b.x) * smoothstep(0.0, 0.08, b.y) * smoothstep(1.0, 0.92, b.y);
  gl_Position = vec4(b * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = size * uDpr;
  vA = a * uMaster;
}`;

export const PARTICLE_FRAG = `#version 300 es
precision highp float;
in float vA;
in float vRing;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.2);
  if (vRing > 0.5) a = 0.5 * exp(-r2 * 1.6) + 0.5 * smoothstep(0.55, 0.85, r2) * (1.0 - smoothstep(0.85, 1.0, r2));
  float alpha = a * vA;
  outColor = vec4(uColor * alpha, alpha);
}`;
