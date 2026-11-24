/** Preview images ("thumbs") stored next to an original in R2. The browser that loads an original scales it down once and
 * uploads the preview; lists and cards then load the preview instead of the multi-megabyte original.
 * 720 px on the long side keeps cards sharp on high-density screens (NPC cards are about 320 css px wide). */
export const THUMB_PX=720;
/** Upper bound the server accepts for an uploaded preview. */
export const THUMB_MAX_BYTES=256*1024;
/** R2 key of the preview. The suffix carries the size so a size change never serves an older, smaller preview. */
export const thumbKey=(key:string)=>key+'.thumb720';
/** Earlier 360 px previews (until 2.5); only cleaned up when the original is deleted. */
export const legacyThumbKey=(key:string)=>key+'.thumb';
/** File id behind a plain protected file URL ("/api/files?id=…"), or "" for anything else (external links, other endpoints). */
export function fileIdFromUrl(url:string|undefined){const m=/^\/api\/files\?id=([^&]+)$/.exec(url||'');return m?decodeURIComponent(m[1]):'';}
