import { env } from 'cloudflare:workers';
import { parseLegalContact, type LegalContact } from '@/domain/legal-contact';

export { werbeanfrageMailto, type LegalContact } from '@/domain/legal-contact';

export function legalContact(): LegalContact {
  return parseLegalContact(env as unknown as Record<string, string | undefined>);
}
