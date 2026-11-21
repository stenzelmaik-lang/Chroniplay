// Galerie: who sees which character images (SL report 21.11.2026: players saw the images of other players in their
// gallery). A player's gallery is personal: only the images of the player's own characters. Images another player
// shared "Für die Gruppe" stay at the table (participant profile), never in someone else's gallery. The SL keeps the
// overview of all images shared with the group.

export type GalleryEntry={fileId:string;caption:string;portrait:boolean};
export type GalleryViewer={id:string;gm:boolean;status:string};

function presentationGallery(value:unknown):{fileId:string;caption:string}[]{
 if(!Array.isArray(value))return [];
 return value.slice(0,8).filter(item=>item&&typeof item.fileId==='string'&&typeof item.caption==='string');
}
function media(body:Record<string,unknown>,onlyShared:boolean):GalleryEntry[]{
 return (Array.isArray(body.characterMedia)?body.characterMedia:[]).slice(0,8)
  .filter((m:Record<string,unknown>)=>m&&typeof m.fileId==='string'&&(!onlyShared||m.shared===true))
  .map((m:Record<string,unknown>)=>({fileId:String(m.fileId),caption:typeof m.caption==='string'?m.caption:'',portrait:m.type==='portrait'}));
}

/** Images the owner shared at the table: the one image list of the Charakterprofil, plus a not yet merged appearance gallery. */
export function sharedImages(body:Record<string,unknown>):GalleryEntry[]{
 const list=media(body,true);
 const presentation=body.presentation as {published?:unknown;gallery?:unknown}|undefined;
 const legacy=presentation?.published===true?presentationGallery(presentation.gallery).filter(item=>!list.some(m=>m.fileId===item.fileId)).map(item=>({...item,portrait:false})):[];
 return [...list,...legacy];
}

/** All images of a character for its owner: shared or not, plus the appearance gallery whether published or not. */
export function ownImages(body:Record<string,unknown>):GalleryEntry[]{
 const list=media(body,false);
 const presentation=body.presentation as {gallery?:unknown}|undefined;
 const legacy=presentationGallery(presentation?.gallery).filter(item=>!list.some(m=>m.fileId===item.fileId)).map(item=>({...item,portrait:false}));
 return [...list,...legacy];
}

/**
 * The gallery images one viewer may see of one character. Players: only their own characters, never another
 * player's. SL: the images shared with the group. Inactive or unknown viewers: nothing.
 */
export function galleryImagesFor(viewer:GalleryViewer,ownerId:string,body:Record<string,unknown>):GalleryEntry[]{
 if(viewer.status!=='active')return [];
 if(viewer.gm)return sharedImages(body);
 return ownerId===viewer.id?ownImages(body):[];
}
