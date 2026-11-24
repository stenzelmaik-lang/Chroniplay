/** Release gate shared by protected live features: a comma list of explicit campaign IDs. Missing or empty means off;
 * a wildcard is never honoured, so a typo cannot open a feature for every campaign. */
export function campaignAllowed(list:string|undefined,campaignId:string){
 return !!campaignId&&(list||'').split(',').map(s=>s.trim()).filter(s=>s&&s!=='*').includes(campaignId);
}
