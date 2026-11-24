import {NextResponse,type NextRequest} from 'next/server';

/** Baseline browser protections for every response (24.11.2026). No Content-Security-Policy yet: the table embeds
 * YouTube, map tiles and the voice SDK, which need a separate, tested allowlist. Camera and microphone stay
 * available to this origin only (voice chat at the table). */
export const SECURITY_HEADERS:Record<string,string>={
  'Strict-Transport-Security':'max-age=15552000',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'SAMEORIGIN',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
};

/** Old public bookmarks lead to the branded address without exposing the account hostname. */
export function middleware(request:NextRequest){
  const url=new URL(request.url);
  const legacy='chronik-von-kleve.stenzel-maik.workers.dev';
  const oldHost=url.hostname===legacy;
  if(oldHost&&['GET','HEAD'].includes(request.method)&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/_next/')){
    url.protocol='https:';
    url.host='chroniplay.cc';
    return NextResponse.redirect(url,307);
  }
  const response=NextResponse.next();
  for(const [name,value] of Object.entries(SECURITY_HEADERS))if(!response.headers.has(name))response.headers.set(name,value);
  return response;
}
export const config={matcher:['/:path*']};
