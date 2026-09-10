#!/usr/bin/env npx tsx
/**
 * Historical appointment import utility (CSV fallback).
 *
 * Usage:
 *   npx tsx scripts/import-history.ts --file appointments.csv [--dry-run]
 *
 * CSV columns (header row required):
 *   first_name, last_name, email, phone, service, stylist,
 *   appointment_at, booked_at, status, external_id
 *
 * - appointment_at: treated as America/New_York local time unless it has a tz suffix.
 * - status: booked | completed | cancelled | no_show (defaults to 'completed' for past dates)
 * - external_id: Google Calendar event ID if known (used for dedup)
 *
 * The script is idempotent: running it twice will skip duplicate records.
 *
 * Requires environment variables (copy from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *   SALON_BUSINESS_ID
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Minimal dotenv loader ────────────────────────────────────────────────────
function loadEnv() {
  const envFile = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const BUSINESS_ID = process.env.SALON_BUSINESS_ID;
const SALON_TZ = 'America/New_York';

if (!SUPABASE_URL || !SUPABASE_KEY || !BUSINESS_ID) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and SALON_BUSINESS_ID must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const fileArgIdx = args.indexOf('--file');
const filePath = fileArgIdx !== -1 ? args[fileArgIdx + 1] : null;
const dryRun = args.includes('--dry-run');

if (!filePath) {
  console.error('Usage: npx tsx scripts/import-history.ts --file <path.csv> [--dry-run]');
  process.exit(1);
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, ''));
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Normalization ─────────────────────────────────────────────────────────────
function normalizeEmail(e: string): string | null {
  const n = e.toLowerCase().trim();
  return n.length > 0 && n.includes('@') ? n : null;
}

function normalizePhone(p: string): string | null {
  const n = p.replace(/\D/g, '');
  return n.length >= 7 ? n : null;
}

function toUTCFromLocal(localStr: string): string {
  if (!localStr) return '';
  // If already has timezone offset, parse directly
  if (/[+-]\d{2}:?\d{2}$|Z$/.test(localStr)) {
    return new Date(localStr).toISOString();
  }
  // Treat as America/New_York local time
  const [datePart] = localStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const isDST = isEasternDST(year, month, day);
  const offset = isDST ? '-04:00' : '-05:00';
  return new Date(`${localStr}${offset}`).toISOString();
}

function isEasternDST(year: number, month: number, day: number): boolean {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  const firstOfMonth = new Date(year, month - 1, 1).getDay();
  if (month === 3) {
    return day >= 1 + (7 - firstOfMonth) % 7 + 7;
  } else {
    return day < 1 + (7 - firstOfMonth) % 7;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const content = fs.readFileSync(path.resolve(filePath!), 'utf8');
  const rows = parseCSV(content);

  console.log(`Loaded ${rows.length} rows from ${filePath}`);
  if (dryRun) console.log('DRY RUN — no changes will be written.\n');

  let imported = 0, skippedDupe = 0, skippedInvalid = 0;
  const invalidReasons: string[] = [];

  for (const row of rows) {
    const {
      first_name, last_name, email, phone, service, stylist,
      appointment_at: apptAt, booked_at, status, external_id,
    } = row;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!first_name) {
      skippedInvalid++;
      invalidReasons.push(`Row missing first_name: ${JSON.stringify(row)}`);
      continue;
    }
    if (!apptAt) {
      skippedInvalid++;
      invalidReasons.push(`Row missing appointment_at for ${first_name}`);
      continue;
    }
    const emailNorm = normalizeEmail(email);
    const phoneNorm = normalizePhone(phone);
    if (!emailNorm && !phoneNorm) {
      skippedInvalid++;
      invalidReasons.push(`Row for ${first_name} has neither valid email nor phone`);
      continue;
    }

    const appointmentAtUtc = toUTCFromLocal(apptAt.includes('T') ? apptAt : `${apptAt}T00:00:00`);
    if (!appointmentAtUtc || isNaN(new Date(appointmentAtUtc).getTime())) {
      skippedInvalid++;
      invalidReasons.push(`Invalid appointment_at for ${first_name}: ${apptAt}`);
      continue;
    }

    // ── Dedup ─────────────────────────────────────────────────────────────────
    if (!dryRun) {
      if (external_id) {
        const { data: existing } = await supabase
          .from('appointments')
          .select('id')
          .eq('external_booking_id', external_id)
          .eq('business_id', BUSINESS_ID)
          .maybeSingle();
        if (existing) {
          skippedDupe++;
          continue;
        }
      }
    }

    // ── Determine status ──────────────────────────────────────────────────────
    const isPast = new Date(appointmentAtUtc) < new Date();
    let apptStatus: 'booked' | 'completed' | 'cancelled' | 'no_show' = isPast ? 'completed' : 'booked';
    if (status && ['booked', 'completed', 'cancelled', 'no_show'].includes(status)) {
      apptStatus = status as typeof apptStatus;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would import: ${first_name} ${last_name} — ${service} — ${appointmentAtUtc}`);
      imported++;
      continue;
    }

    // ── Upsert customer ───────────────────────────────────────────────────────
    let customerId: string;
    try {
      // Try email match
      let customer = null;
      if (emailNorm) {
        const { data } = await supabase.from('customers').select('id, email').eq('business_id', BUSINESS_ID).eq('email_normalized', emailNorm).maybeSingle();
        customer = data;
      }
      if (!customer && phoneNorm) {
        const { data } = await supabase.from('customers').select('id, phone').eq('business_id', BUSINESS_ID).eq('phone_normalized', phoneNorm).maybeSingle();
        customer = data;
      }

      if (!customer) {
        const { data, error } = await supabase.from('customers').insert({
          business_id: BUSINESS_ID, first_name, last_name: last_name || '',
          email: email || null, phone: phone || null,
          email_normalized: emailNorm, phone_normalized: phoneNorm,
          source: 'historical_import',
        }).select('id').single();
        if (error) throw error;
        customer = data;
      } else {
        await supabase.from('customers').update({ last_seen_at: new Date().toISOString() }).eq('id', customer.id);
      }
      customerId = customer.id;
    } catch (err) {
      skippedInvalid++;
      invalidReasons.push(`Customer upsert failed for ${first_name}: ${err}`);
      continue;
    }

    // ── Insert appointment ────────────────────────────────────────────────────
    const bookedAtUtc = booked_at ? toUTCFromLocal(booked_at.includes('T') ? booked_at : `${booked_at}T09:00:00`) : appointmentAtUtc;
    const durationMs = 60 * 60 * 1000; // default 60 min if end time not in CSV
    const appointmentEndAt = new Date(new Date(appointmentAtUtc).getTime() + durationMs).toISOString();

    const { error } = await supabase.from('appointments').insert({
      business_id: BUSINESS_ID,
      customer_id: customerId,
      service: service || 'Unknown Service',
      stylist: stylist || null,
      appointment_at: appointmentAtUtc,
      appointment_end_at: appointmentEndAt,
      duration_minutes: 60,
      appointment_status: apptStatus,
      sync_status: 'synced',
      booking_source: 'historical_import',
      external_booking_id: external_id || null,
      booked_at: bookedAtUtc,
    });

    if (error) {
      skippedInvalid++;
      invalidReasons.push(`Insert failed for ${first_name}: ${error.message}`);
      continue;
    }

    // Log event
    await supabase.from('appointment_events').insert({
      business_id: BUSINESS_ID, customer_id: customerId,
      event_type: 'appointment_created',
      metadata: { imported: true, booking_source: 'historical_import' },
    });

    imported++;
    process.stdout.write('.');
  }

  console.log('\n');
  console.log(`✓ Imported:          ${imported}`);
  console.log(`  Skipped duplicate: ${skippedDupe}`);
  console.log(`  Skipped invalid:   ${skippedInvalid}`);

  if (invalidReasons.length > 0) {
    console.log('\nInvalid records:');
    invalidReasons.forEach(r => console.log('  -', r));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
