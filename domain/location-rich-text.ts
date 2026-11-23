import { parseFragment } from 'parse5';
import { authoringSourceMax } from './authoring-limits.ts';
export const richTextPrefix = "cvk-rich-v1:";

/** Structural bounds of one rich-text document (P1 2026-11-22).
 * The visible-text limit of each field and the bounded source length remain the primary limits; these values only stop
 * pathological nesting. The former values (120 blocks, 30 table rows, 800 formatted passages, 5,000 HTML nodes)
 * rejected ordinary long scenes far below 20,000 visible characters, for example a dialogue table with 30 lines. */
export const richTextStructureLimits = { blocks: 1000, partsPerBlock: 1000, listItems: 500, tableRows: 300, tableColumns: 10, inlines: 10000, htmlNodes: 60000 } as const;
const L = richTextStructureLimits;
const de = (n: number) => n.toLocaleString("de-DE");

/** Campaign presets offered first in the colour menu; any other #rrggbb colour from the colour wheel is allowed too. */
export const richTextColors = ["#d6b36f", "#eee6d6", "#a9c3cf", "#d38b82"] as const;
export type RichTextColor = string;
export const isRichTextColor = (value: unknown): value is RichTextColor => typeof value === "string" && /^#[0-9a-f]{6}$/.test(value);

export const richTextClasses = ["cp-intro", "cp-highlight", "cp-note", "cp-divider", "cp-subtitle", "cp-align-center", "cp-align-right"] as const;

function allowedClasses(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 200) return undefined;
  const classes = [...new Set(value.split(/\s+/).filter(name => richTextClasses.includes(name as typeof richTextClasses[number])))];
  return classes.length ? classes.join(" ") : undefined;
}

export type RichTextInline = {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  color?: RichTextColor;
  href?: string;
  className?: string;
};

export type RichTextBlock = (
  | { type: "paragraph"; children: RichTextInline[] }
  | { type: "heading2"; children: RichTextInline[] }
  | { type: "heading3"; children: RichTextInline[] }
  | { type: "bulletList"; items: RichTextInline[][] }
  | { type: "orderedList"; items: RichTextInline[][] }
  | { type: "quote"; children: RichTextInline[] }
  | { type: "table"; rows: RichTextInline[][][]; header?: boolean }
  | { type: "details"; summary: string; content: RichTextDocument }
  | { type: "image"; fileId: string; alt: string }
  | { type: "divider" }
) & { className?: string };

export type RichTextDocument = { version: 1; blocks: RichTextBlock[] };

const safeHref = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length > 1000) return undefined;
  if (/^\/(?:sl\/command-center|spielbereich)(?:\?|$)/.test(value) && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

function parseInline(value: unknown): RichTextInline | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !["text", "bold", "italic", "underline", "strike", "color", "href", "className"].includes(key))) return null;
  if (typeof row.text !== "string" || row.text.length > 25000) return null;
  if (row.bold !== undefined && row.bold !== true || row.italic !== undefined && row.italic !== true || row.underline !== undefined && row.underline !== true || row.strike !== undefined && row.strike !== true) return null;
  if (row.color !== undefined && !isRichTextColor(row.color)) return null;
  const href = row.href === undefined ? undefined : safeHref(row.href);
  if (row.href !== undefined && !href) return null;
  const className = allowedClasses(row.className);
  if (row.className !== undefined && (!className || className !== row.className)) return null;
  return {
    text: row.text,
    ...(row.bold ? { bold: true as const } : {}),
    ...(row.italic ? { italic: true as const } : {}),
    ...(row.underline ? { underline: true as const } : {}),
    ...(row.strike ? { strike: true as const } : {}),
    ...(row.color ? { color: row.color as RichTextColor } : {}),
    ...(href ? { href } : {}),
    ...(className ? { className } : {}),
  };
}

export function parseRichTextDocument(value: unknown, nesting = 0): RichTextDocument | null {
  if(nesting>4)return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => key !== "version" && key !== "blocks")) return null;
  if (row.version !== 1 || !Array.isArray(row.blocks) || row.blocks.length > L.blocks) return null;
  const blocks: RichTextBlock[] = [];
  let inlineCount = 0;
  for (const candidate of row.blocks) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const { className: rawClassName, ...block } = candidate as Record<string, unknown>;
    const className = allowedClasses(rawClassName);
    if (rawClassName !== undefined && (!className || className !== rawClassName)) return null;
    if (["paragraph", "heading2", "heading3", "quote"].includes(String(block.type))) {
      if (Object.keys(block).some(key => key !== "type" && key !== "children")) return null;
      if (!Array.isArray(block.children) || block.children.length > L.partsPerBlock) return null;
      const children = block.children.map(parseInline);
      if (children.some(item => item === null)) return null;
      inlineCount += children.length;
      blocks.push({ type: block.type as "paragraph" | "heading2" | "heading3" | "quote", children: children as RichTextInline[] });
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      if (Object.keys(block).some(key => key !== "type" && key !== "items")) return null;
      if (!Array.isArray(block.items) || block.items.length > L.listItems) return null;
      const items: RichTextInline[][] = [];
      for (const rawItem of block.items) {
        if (!Array.isArray(rawItem) || rawItem.length > L.partsPerBlock) return null;
        const parsed = rawItem.map(parseInline);
        if (parsed.some(item => item === null)) return null;
        inlineCount += parsed.length;
        items.push(parsed as RichTextInline[]);
      }
      blocks.push({ type: block.type, items });
    } else if (block.type === "divider" && Object.keys(block).length === 1) {
      blocks.push({ type: "divider" });
    } else if (block.type === "image") {
      if (Object.keys(block).some(k => !['type','fileId','alt'].includes(k)) || typeof block.fileId !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(block.fileId) || typeof block.alt !== 'string' || block.alt.length > 300) return null;
      blocks.push({type:'image', fileId:block.fileId, alt:block.alt});
    } else if (block.type === 'details') {
      if(Object.keys(block).some(k=>!['type','summary','content'].includes(k))||typeof block.summary!=='string'||!block.summary.trim()||block.summary.length>200)return null;
      const content=parseRichTextDocument(block.content,nesting+1);if(!content)return null;
      blocks.push({type:'details',summary:block.summary,content});
    } else if (block.type === 'table') {
      if(Object.keys(block).some(k=>!['type','rows','header'].includes(k)) || !Array.isArray(block.rows) || block.rows.length>L.tableRows) return null;
      const rows: RichTextInline[][][]=[];
      for(const raw of block.rows) {
        if(!Array.isArray(raw)||raw.length>L.tableColumns)return null;
        const cells: RichTextInline[][]=[];
        for(const cell of raw) {
          if(!Array.isArray(cell)||cell.length>L.partsPerBlock)return null;
          const parts=cell.map(parseInline);if(parts.some(p=>p===null))return null;
          inlineCount+=parts.length;cells.push(parts as RichTextInline[]);
        }
        rows.push(cells);
      }
      if(block.header!==undefined&&typeof block.header!=='boolean')return null;
      blocks.push({type:'table',rows,...(block.header?{header:true}:{})});
    } else return null;
    if (className) blocks[blocks.length - 1].className = className;
    if (inlineCount > L.inlines) return null;
  }
  return { version: 1, blocks };
}

export function legacyRichTextDocument(value: string): RichTextDocument {
  const lines = value.split(/\r?\n/);
  return { version: 1, blocks: (lines.length ? lines : [""]).map(line => ({ type: "paragraph" as const, children: [{ text: line }] })) };
}

export function readRichText(value: string): RichTextDocument {
  if (value.startsWith(richTextPrefix)) {
    try {
      const parsed = parseRichTextDocument(JSON.parse(value.slice(richTextPrefix.length)));
      if (parsed) return parsed;
    } catch { /* Invalid rich-text is rendered as harmless literal text. */ }
  }
  return legacyRichTextDocument(value);
}

export function encodeRichText(document: RichTextDocument): string {
  const parsed = parseRichTextDocument(document);
  return parsed ? richTextPrefix + JSON.stringify(parsed) : "";
}

// Read-only presentation of indented HTML, never a storage/editor conversion.
// v1 does not record the origin of every newline: ambiguous unindented breaks
// are retained rather than silently erased, including after HTML roundtrips.
export function proseInlineParts(parts: RichTextInline[]): RichTextInline[] {
  const indented = /\r?\n[\t ]+/.test(parts.map(part => part.text).join(""));
  return parts.flatMap((part, index) => {
    let text = part.text;
    if (indented && !/^(?:\r?\n)+$/.test(text)) {
      text = text.replace(/\r?\n[\t ]+/g, " ");
      if (index === 0) text = text.replace(/^[\t\r\n\f ]+/, "");
      if (index === parts.length - 1) text = text.replace(/[\t\r\n\f ]+$/, "");
    }
    return text.split(/\r?\n/).flatMap((line, lineIndex) => [
      ...(lineIndex ? [{ ...part, text: "\n" }] : []),
      ...(line ? [{ ...part, text: line }] : []),
    ]);
  });
}

// Presentation only: the stored document is never rewritten or truncated.
export function splitRichTextIntroduction(value: string): { introduction: string | null; description: string } {
  const document = readRichText(value);
  const isIntro = (block: RichTextBlock) => {
    if (block.className?.split(" ").includes("cp-intro")) return true;
    // Also support an introduction wrapped in an existing allowed <span>.
    if (block.type !== "paragraph") return false;
    const content = block.children.filter(part => part.text.trim());
    return content.length > 0 && content.every(part => part.className?.split(" ").includes("cp-intro"));
  };
  const start = document.blocks.findIndex(isIntro);
  if (start < 0) return { introduction: null, description: value };
  let end = start + 1;
  while (end < document.blocks.length && isIntro(document.blocks[end])) end++;
  const remaining = [...document.blocks.slice(0, start), ...document.blocks.slice(end)];
  return {
    introduction: encodeRichText({ version: 1, blocks: document.blocks.slice(start, end) }),
    description: remaining.length ? encodeRichText({ version: 1, blocks: remaining }) : "",
  };
}

export function richTextToPlainText(value: string): string {
  return readRichText(value).blocks.map(block => {
    if(block.type==='details')return block.summary+'\n'+richTextToPlainText(encodeRichText(block.content));
    if(block.type==='divider')return '';
    if(block.type==='image')return block.alt;
    if(block.type==='table')return block.rows.map(row=>row.map(c=>c.map(p=>p.text).join('')).join(' | ')).join('\n');
    return block.type === 'bulletList' || block.type === 'orderedList' ? block.items.map(item=>item.map(p=>p.text).join('')).join('\n') : block.children.map(p=>p.text).join('');
  }).join('\n');
}

export function isRichTextWithinLimit(value: string, maximumPlainLength: number): boolean {
  if (!value.startsWith(richTextPrefix)) return value.trim().length <= maximumPlainLength;
  // Bound structural overhead independently: formatting is not visible text.
  if (value.length > Math.max(65000, maximumPlainLength * 6 + 512)) return false;
  try {
    const document = parseRichTextDocument(JSON.parse(value.slice(richTextPrefix.length)));
    return Boolean(document && richTextToPlainText(encodeRichText(document)).trim().length <= maximumPlainLength);
  } catch {
    return false;
  }
}

// HTML is parsed into the existing typed document. Raw markup is never rendered or stored.
export const richHtmlPrefix='cvk-html-v1:';

/** Recognize an explicitly pasted HTML fragment, not angle brackets in prose.
 * Recognition is only a format hint; the existing parser remains the sanitizer. */
export function htmlTextToRichText(value:string):string|null {
  const source=cleanHtmlSource(value);
  if (!/^\s*<(?:p|h[1-6]|ul|ol|blockquote|table|div|section|article|aside|header|main|center|details|figure|strong|b|em|i|u|span|hr|br)(?:\s|\/?>)/i.test(source)
    || !/(?:<\/(?:p|h[1-6]|ul|ol|blockquote|table|div|section|article|aside|header|main|center|details|figure|strong|b|em|i|u|span)\s*>|<(?:hr|br)\b[^>]*\/?>)\s*$/i.test(source)) return null;
  try { return htmlToRichText(source); }
  catch { return null; } // Preserve the original text if formatting cannot be represented safely.
}
type HtmlNode={nodeName:string;tagName?:string;value?:string;attrs?:{name:string;value:string}[];childNodes?:HtmlNode[]};
const forbidden=new Set(['script','style','iframe','object','embed','svg','math','template','noscript','form','input','button','video','audio','head','title','meta','link','base']);

/** HTML from other tools often arrives wrapped: a Markdown code fence (```html … ```) or a whole page.
 * Only the content is kept; the sanitizer below still decides what survives. */
export function cleanHtmlSource(html:string):string {
  let source=html.replace(/^\uFEFF/,'').trim();
  const fence=source.match(/^```[a-zA-Z0-9-]*[ \t]*\r?\n([\s\S]*?)\r?\n?```\s*$/);
  if(fence)source=fence[1].trim();
  const body=source.match(/<body\b[^>]*>([\s\S]*)<\/body\s*>/i);
  if(body)source=body[1].trim();
  return source;
}
const namedColors:Record<string,string>={white:'#ffffff',black:'#000000',red:'#d32f2f',darkred:'#8b0000',crimson:'#dc143c',maroon:'#800000',gold:'#ffd700',goldenrod:'#daa520',orange:'#ffa500',yellow:'#ffeb3b',green:'#2e7d32',darkgreen:'#006400',blue:'#1e88e5',navy:'#000080',purple:'#800080',brown:'#8b4513',gray:'#808080',grey:'#808080',silver:'#c0c0c0',beige:'#f5f5dc',ivory:'#fffff0',wheat:'#f5deb3',tan:'#d2b48c'};
/** A CSS colour as #rrggbb, or undefined: #rgb, #rrggbb, rgb()/rgba() (alpha dropped) and a few common names. */
export function cssColorToHex(value:string|undefined):string|undefined {
  const v=value?.trim().toLowerCase();if(!v)return undefined;
  if(/^#[0-9a-f]{6}$/.test(v))return v;
  const short=v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);if(short)return '#'+short.slice(1).map(c=>c+c).join('');
  const rgb=v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+%?\s*)?\)$/);
  if(rgb){const parts=rgb.slice(1,4).map(Number);return parts.every(n=>n<=255)?'#'+parts.map(n=>n.toString(16).padStart(2,'0')).join(''):undefined;}
  return namedColors[v];
}
function styleOf(n:HtmlNode):Record<string,string> {
  const out:Record<string,string>={};
  for(const declaration of (n.attrs?.find(a=>a.name==='style')?.value||'').slice(0,2000).split(';')){
    const i=declaration.indexOf(':');if(i>0)out[declaration.slice(0,i).trim().toLowerCase()]=declaration.slice(i+1).trim().toLowerCase().replace(/\s*!important$/,'');
  }
  return out;
}
type Align=''|'center'|'right';
function alignOf(n:HtmlNode,inherited:Align):Align {
  const value=(styleOf(n)['text-align']||n.attrs?.find(a=>a.name==='align')?.value||'').toLowerCase();
  if(n.tagName==='center'||value==='center')return 'center';
  if(value==='right'||value==='end')return 'right';
  if(value==='left'||value==='start'||value==='justify')return '';
  return inherited;
}
const supportedStyles=new Set(['color','font-weight','font-style','text-decoration','text-decoration-line','text-align']);
/** What a pasted HTML fragment loses on import, in plain German, so the SL can adjust the source or the other tool. */
export function htmlImportNotes(html:string):string[] {
  const source=cleanHtmlSource(html);if(!source||source.length>authoringSourceMax)return [];
  let root:HtmlNode;try{root=parseFragment(source) as unknown as HtmlNode;}catch{return [];}
  const notes:string[]=[],lost=new Set<string>(),classes=new Set<string>();let count=0,styleBlock=false,unsafe=false,externalImage=false;
  const visit=(n:HtmlNode,depth=0)=>{
    if(++count>L.htmlNodes||depth>40)return;
    const tag=n.tagName||'';
    if(tag==='style')styleBlock=true;
    else if(['script','iframe','object','embed','form','input','button','video','audio','svg','math'].includes(tag))unsafe=true;
    else if(tag==='img'&&!/^\/api\/files\?id=[a-zA-Z0-9_.-]{1,100}$/.test(n.attrs?.find(a=>a.name==='src')?.value||''))externalImage=true;
    for(const key of Object.keys(styleOf(n)))if(!supportedStyles.has(key))lost.add(key);
    for(const name of (n.attrs?.find(a=>a.name==='class')?.value||'').split(/\s+/))if(name&&!richTextClasses.includes(name as typeof richTextClasses[number]))classes.add(name);
    (n.childNodes||[]).forEach(c=>visit(c,depth+1));
  };
  (root.childNodes||[]).forEach(n=>visit(n));
  const list=(set:Set<string>)=>[...set].slice(0,8).join(', ')+(set.size>8?' …':'');
  if(lost.size)notes.push('Nicht übernommene Stilangaben: '+list(lost)+'. Übernommen werden Textfarbe, fett, kursiv, unterstrichen, durchgestrichen und Ausrichtung.');
  if(classes.size)notes.push('Unbekannte Klassen ignoriert: '+list(classes)+'. Gestalten kannst du mit '+richTextClasses.join(', ')+'.');
  if(styleBlock)notes.push('Stilblöcke (<style>) werden nicht übernommen – nutze die cp-Klassen oder Farben direkt am Text.');
  if(unsafe)notes.push('Skripte, Einbettungen, Formulare und Medien-Elemente werden aus Sicherheitsgründen entfernt.');
  if(externalImage)notes.push('Bilder von außerhalb werden entfernt. Bilder fügst du über die Galerie ein.');
  return notes;
}
/** Copyable brief for another AI, so the HTML it writes keeps its look in ChroniPlay. */
export const htmlAuthoringGuide=[
  'Schreibe den Text als reines HTML-Fragment für ChroniPlay – ohne <html>, <head>, <body>, <style> oder <script> und ohne Code-Block-Markierung.',
  'Erlaubte Elemente: <h2>, <h3>, <p>, <strong>, <em>, <u>, <s>, <ul>/<ol>/<li>, <blockquote>, <hr>, <table> mit <tr>, <th>, <td>, <details> mit <summary>, <a href="https://…">.',
  'Gestaltung nur über diese Klassen: cp-intro (Einleitung), cp-subtitle (Untertitel), cp-highlight (Hervorhebung), cp-note (Hinweis), cp-divider (Trennung), cp-align-center und cp-align-right (Ausrichtung). Mehrere Klassen mit Leerzeichen trennen.',
  'Farben nur direkt am Text als style="color:#rrggbb". Fett, kursiv und Ausrichtung dürfen auch als style angegeben werden.',
  'Keine Rahmen, Hintergründe, Schriftgrößen, Schriftarten, Abstände, Bilder oder Einbettungen – die Darstellung übernimmt ChroniPlay.',
].join('\n');
const tooComplex='Das HTML ist zu tief verschachtelt oder enthält mehr als '+de(L.htmlNodes)+' Elemente. Bitte vereinfache die Struktur oder teile den Inhalt auf mehrere Felder auf.';
/** Names the first structural bound a document exceeds, in plain German, so nothing is rejected without a reason. */
export function richTextStructureIssue(blocks:RichTextBlock[],nesting=0):string|null {
  if(nesting>4)return 'Aufklappbare Abschnitte sind zu tief ineinander verschachtelt (höchstens 4 Ebenen).';
  if(blocks.length>L.blocks)return 'Der Text hat '+de(blocks.length)+' Abschnitte; erlaubt sind höchstens '+de(L.blocks)+'. Bitte teile ihn auf mehrere Felder oder Bausteine auf.';
  let parts=0;
  for(const b of blocks){
    if(b.type==='table'){
      if(b.rows.length>L.tableRows)return 'Eine Tabelle hat '+de(b.rows.length)+' Zeilen; erlaubt sind höchstens '+de(L.tableRows)+' je Tabelle. Bitte teile sie in mehrere Tabellen auf.';
      const widest=Math.max(0,...b.rows.map(r=>r.length));
      if(widest>L.tableColumns)return 'Eine Tabelle hat '+widest+' Spalten; erlaubt sind höchstens '+L.tableColumns+'.';
      parts+=b.rows.reduce((n,r)=>n+r.reduce((m,c)=>m+c.length,0),0);
    } else if(b.type==='bulletList'||b.type==='orderedList'){
      if(b.items.length>L.listItems)return 'Eine Liste hat '+de(b.items.length)+' Einträge; erlaubt sind höchstens '+de(L.listItems)+'.';
      parts+=b.items.reduce((n,i)=>n+i.length,0);
    } else if(b.type==='details'){const inner=richTextStructureIssue(b.content.blocks,nesting+1);if(inner)return inner;}
    else if('children' in b){if(b.children.length>L.partsPerBlock)return 'Ein Absatz enthält mehr als '+de(L.partsPerBlock)+' einzeln formatierte Textstellen. Bitte vereinfache die Formatierung.';parts+=b.children.length;}
  }
  if(parts>L.inlines)return 'Der Text enthält '+de(parts)+' einzeln formatierte Textstellen; erlaubt sind höchstens '+de(L.inlines)+'. Bitte vereinfache die Formatierung oder teile den Text auf.';
  return null;
}
export function htmlToRichText(html:string):string {
  if(html.length>authoringSourceMax)throw new Error('Das HTML ist zu lang (höchstens '+de(authoringSourceMax)+' Zeichen Quelltext je Feld). Bitte teile den Inhalt auf mehrere Felder oder Bausteine auf.');
  const root=parseFragment(cleanHtmlSource(html)) as unknown as HtmlNode;
  let visited=0;
  const inline=(n:HtmlNode,marks:Omit<RichTextInline,'text'>={},depth=0):RichTextInline[]=>{
    if(++visited>L.htmlNodes||depth>40)throw new Error(tooComplex);
    if(n.nodeName==='#text')return [{text:n.value||'',...marks}];
    const tag=n.tagName||'';if(forbidden.has(tag))return [];
    const m={...marks},style=styleOf(n),decoration=style['text-decoration-line']||style['text-decoration']||'';
    if(['b','strong'].includes(tag)||/^(?:bold|bolder|[6-9]00)$/.test(style['font-weight']||''))m.bold=true;
    if(['i','em','cite','q','dfn','var'].includes(tag)||/^(?:italic|oblique)/.test(style['font-style']||''))m.italic=true;
    if(['u','ins'].includes(tag)||decoration.includes('underline'))m.underline=true;
    if(['s','strike','del'].includes(tag)||decoration.includes('line-through'))m.strike=true;
    if(['span','mark','font','strong','b','em','i'].includes(tag)){
      const className=allowedClasses([marks.className,n.attrs?.find(a=>a.name==='class')?.value,tag==='mark'?'cp-highlight':''].filter(Boolean).join(' '));
      if(className)m.className=className;
    }
    const color=cssColorToHex(style.color)||cssColorToHex(n.attrs?.find(a=>a.name==='color')?.value);if(color&&isRichTextColor(color))m.color=color;
    if(tag==='a'){const href=safeHref(n.attrs?.find(a=>a.name==='href')?.value);if(href)m.href=href;}
    if(tag==='br')return [{text:'\n',...m}];
    const children:RichTextInline[]=[];
    const lineBlocks=new Set(['p','div','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','dt','dd','pre','figcaption']);
    let previousWasBlock=false;
    for(const child of n.childNodes||[]){
      const parts=inline(child,m,depth+1), isBlock=lineBlocks.has(child.tagName||'');
      if(parts.length&&children.length&&(isBlock||previousWasBlock)&&!children.at(-1)!.text.endsWith('\n'))children.push({text:'\n',...m});
      children.push(...parts);
      if(parts.length)previousWasBlock=isBlock;
    }
    return children;
  };
  const blocks:RichTextBlock[]=[];
  const walk=(n:HtmlNode,depth=0,inheritedAlign:Align='')=>{
    if(depth>40||++visited>L.htmlNodes)throw new Error(tooComplex);
    const tag=n.tagName||'';if(forbidden.has(tag))return;
    const align=n.nodeName==='#text'?inheritedAlign:alignOf(n,inheritedAlign);
    const className=allowedClasses([n.attrs?.find(a=>a.name==='class')?.value,align==='center'?'cp-align-center':align==='right'?'cp-align-right':''].filter(Boolean).join(' '));
    const decoration=className?{className}:{};
    if(tag==='hr'){blocks.push({type:'divider',...decoration});return;}
    if(tag==='img'){
      const src=n.attrs?.find(a=>a.name==='src')?.value||'';const match=src.match(/^\/api\/files\?id=([a-zA-Z0-9_.-]{1,100})$/);
      if(match)blocks.push({type:'image',fileId:match[1],alt:(n.attrs?.find(a=>a.name==='alt')?.value||'Ortsunabhängiges SL-Bild').slice(0,300)});return;
    }
    if(tag==='details'){
      const summary=(n.childNodes||[]).find(c=>c.tagName==='summary');
      const start=blocks.length;(n.childNodes||[]).filter(c=>c!==summary).forEach(c=>walk(c,depth+1,align));
      const content=blocks.splice(start);blocks.push({type:'details',summary:(summary?inline(summary).map(p=>p.text).join(''):'Weiterlesen').trim().slice(0,200)||'Weiterlesen',content:{version:1,blocks:content},...decoration});return;
    }
    if(tag==='table'){
      const rows:RichTextInline[][][]=[];
      const tr=(node:HtmlNode,d=0)=>{if(d>40)throw new Error(tooComplex);if(node.tagName==='tr')rows.push((node.childNodes||[]).filter(c=>['td','th'].includes(c.tagName||'')).map(c=>inline(c)));else(node.childNodes||[]).forEach(c=>{if(++visited>L.htmlNodes)throw new Error(tooComplex);tr(c,d+1);});};tr(n);
      const hasHeader=(node:HtmlNode):boolean=>node.tagName==='th'||(node.childNodes||[]).some(hasHeader);
      blocks.push({type:'table',rows,...(hasHeader(n)?{header:true}:{}),...decoration});return;
    }
    if(tag==='ul'||tag==='ol'){blocks.push({type:tag==='ul'?'bulletList':'orderedList',items:(n.childNodes||[]).filter(c=>c.tagName==='li').map(c=>inline(c)),...decoration});return;}
    // Browsers create inline-only <div> lines (including <div><br></div>)
    // for Enter/pasted newlines. Preserve them as paragraphs, not loose text.
    const editorLine = tag === 'div' && !(n.childNodes || []).some(child => /^(?:p|div|section|article|h[1-6]|ul|ol|table|blockquote)$/.test(child.tagName || ''));
    if(['p','h1','h2','h3','h4','h5','h6','blockquote','pre','dt','dd','figcaption','address'].includes(tag)||editorLine){
      blocks.push({type:tag==='blockquote'?'quote':['h1','h2'].includes(tag)?'heading2':['h3','h4','h5','h6'].includes(tag)?'heading3':'paragraph',children:(n.childNodes?.length===1&&n.childNodes[0].tagName==='br')?[]:inline(n,tag==='dt'?{bold:true}:{}),...decoration});
      (n.childNodes||[]).filter(c=>c.tagName==='img'||c.tagName==='hr').forEach(c=>walk(c,depth+1,align));return;
    }
    if(['span','a','b','strong','i','em','u','s','strike','del','font','mark','cite','q','code','small','sub','sup','abbr','time','ins'].includes(tag)){blocks.push({type:'paragraph',children:(n.childNodes?.length===1&&n.childNodes[0].tagName==='br')?[]:inline(n),...(align?{className:align==='center'?'cp-align-center':'cp-align-right'}:{})});return;}
    if(n.nodeName==='#text'){if(n.value?.trim())blocks.push({type:'paragraph',children:[{text:n.value}],...(inheritedAlign?{className:inheritedAlign==='center'?'cp-align-center':'cp-align-right'}:{})});return;}
    (n.childNodes||[]).forEach(c=>walk(c,depth+1,align));
  };
  (root.childNodes||[]).forEach(n=>walk(n));
  const parsed=parseRichTextDocument({version:1,blocks});if(!parsed)throw new Error(richTextStructureIssue(blocks)||'HTML überschreitet die zulässige Dokumentstruktur.');return encodeRichText(parsed);
}
export function sanitizeRichTextInput(value:string):string { return value.startsWith(richHtmlPrefix)?htmlToRichText(value.slice(richHtmlPrefix.length)):value; }

export function inspectRichTextSource(html:string, maximumPlainLength:number):{value?:string;plainLength:number|null;error:string} {
  try {
    const value=htmlToRichText(html),plainLength=richTextToPlainText(value).length;
    return {value,plainLength,error:isRichTextWithinLimit(value,maximumPlainLength)?'':`Bitte kürze den sichtbaren Text auf ${maximumPlainLength} Zeichen oder vereinfache die Formatierung.`};
  } catch(error) {
    return {plainLength:null,error:error instanceof Error?error.message:'HTML konnte nicht geprüft werden.'};
  }
}

const escapeHtml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function richTextToHtml(value:string,flowing=false):string {
  const classes=(value:unknown)=>{const safe=allowedClasses(value);return safe?' class="'+safe+'"':'';};
  // Keep separately recorded hard breaks separate on export/reimport, even
  // when the following text starts with spaces. Other source whitespace stays literal.
  const parts=(v:RichTextInline[])=>(flowing?proseInlineParts(v):v).map(p=>{let t=/^(?:\r?\n)+$/.test(p.text)?p.text.replace(/\r?\n/g,'<br>'):escapeHtml(p.text);if(p.bold)t='<strong>'+t+'</strong>';if(p.italic)t='<em>'+t+'</em>';if(p.underline)t='<u>'+t+'</u>';if(p.strike)t='<s>'+t+'</s>';if(p.color)t='<span style="color:'+p.color+'">'+t+'</span>';if(p.className)t='<span'+classes(p.className)+'>'+t+'</span>';if(p.href)t='<a href="'+escapeHtml(p.href)+'">'+t+'</a>';return t;}).join('');
  return readRichText(value).blocks.map(b=>{
    const decoration=classes(b.className);
    if(b.type==='divider')return '<hr'+decoration+'>';
    if(b.type==='image')return '<img src="/api/files?id='+escapeHtml(b.fileId)+'" alt="'+escapeHtml(b.alt)+'">';
    if(b.type==='details')return '<details'+decoration+'><summary>'+escapeHtml(b.summary)+'</summary>'+richTextToHtml(encodeRichText(b.content),flowing)+'</details>';
    if(b.type==='table')return '<table'+decoration+'><tbody>'+b.rows.map((r,i)=>'<tr>'+r.map(c=>{const tag=b.header&&i===0?'th':'td';return '<'+tag+'>'+parts(c)+'</'+tag+'>';}).join('')+'</tr>').join('')+'</tbody></table>';
    if(b.type==='bulletList'||b.type==='orderedList'){const tag=b.type==='bulletList'?'ul':'ol';return '<'+tag+decoration+'>'+b.items.map(i=>'<li>'+parts(i)+'</li>').join('')+'</'+tag+'>';}
    const tag=b.type==='heading2'?'h2':b.type==='heading3'?'h3':b.type==='quote'?'blockquote':'p';return '<'+tag+decoration+'>'+parts(b.children)+'</'+tag+'>';
  }).join(flowing ? '' : '\n');
}
export function richTextFileIds(value:string):string[] { return readRichText(value).blocks.flatMap(b=>b.type==='image'?[b.fileId]:b.type==='details'?richTextFileIds(encodeRichText(b.content)):[]); }
