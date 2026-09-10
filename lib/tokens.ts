import { randomBytes, createHash } from 'crypto';

export interface ManagementToken {
  /** Raw token given to the customer in the management URL. Never stored in DB. */
  rawToken: string;
  /** SHA-256 of rawToken stored in appointments.management_token_hash. */
  tokenHash: string;
  /** Google Calendar event ID (UUID without dashes — valid base32hex chars). */
  gcalEventId: string;
}

/**
 * Generates a cryptographically secure management token.
 * - rawToken: 64-char hex (256 bits) → goes in the customer URL
 * - tokenHash: SHA-256(rawToken) → stored in the database
 */
export function generateManagementToken(appointmentId: string): ManagementToken {
  const raw = randomBytes(32);
  const rawToken = raw.toString('hex');
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  const gcalEventId = appointmentId.replace(/-/g, '');
  return { rawToken, tokenHash, gcalEventId };
}

/**
 * Computes the hash for looking up a management token from a URL parameter.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(Buffer.from(rawToken, 'hex')).digest('hex');
}
