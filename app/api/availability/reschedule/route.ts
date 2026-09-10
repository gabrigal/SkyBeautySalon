import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAppointmentByToken } from '@/lib/db/appointments';
import { hashToken } from '@/lib/tokens';

const N8N_AVAILABILITY = process.env.N8N_AVAILABILITY_URL
  ?? 'https://gabrigal.app.n8n.cloud/webhook/sky-beauty-availability';

/**
 * GET /api/availability/reschedule?token=RAW_TOKEN&date=YYYY-MM-DD
 *
 * Returns available time slots for a reschedule request.
 * Calls the existing n8n availability endpoint and removes the current
 * appointment's time slot from the "taken" list (self-conflict prevention).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const date = searchParams.get('date');

  if (!token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date parameter required (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const appointment = await getAppointmentByToken(supabase, token);

  if (!appointment || appointment.appointment_status !== 'booked') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Build n8n availability URL (same as the browser currently calls directly)
  const stylistParam = appointment.stylist
    ? `&stylist=${encodeURIComponent(appointment.stylist)}`
    : '';
  const availUrl = `${N8N_AVAILABILITY}?date=${date}${stylistParam}`;

  let taken: string[] = [];
  try {
    const res = await fetch(availUrl, { next: { revalidate: 0 } });
    if (res.ok) {
      const data = await res.json();
      taken = Array.isArray(data?.taken) ? data.taken : [];
    }
  } catch {
    // If availability check fails, return all slots as available
    // (conservative: let the booking-time conflict check catch any issues)
  }

  // Remove the current appointment's time from "taken" so the customer
  // can see their own slot as available (self-conflict prevention).
  const currentTime = formatTime(appointment.appointment_at);
  const filtered = taken.filter(t => t !== currentTime);

  return NextResponse.json({ taken: filtered });
}

const SALON_TZ = 'America/New_York';

function formatTime(utcISO: string): string {
  return new Date(utcISO).toLocaleTimeString('en-US', {
    timeZone: SALON_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
