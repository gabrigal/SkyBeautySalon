import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAppointmentByToken } from '@/lib/db/appointments';

const SALON_TZ = 'America/New_York';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = createServiceClient();
  const appointment = await getAppointmentByToken(supabase, token);

  if (!appointment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Format appointment time for display in the salon timezone
  const appointmentDate = new Date(appointment.appointment_at);
  const displayDate = appointmentDate.toLocaleDateString('en-US', {
    timeZone: SALON_TZ,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const displayTime = appointmentDate.toLocaleTimeString('en-US', {
    timeZone: SALON_TZ,
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const customer = appointment.customers;

  return NextResponse.json({
    appointment: {
      id: appointment.id,
      service: appointment.service,
      stylist: appointment.stylist,
      appointment_status: appointment.appointment_status,
      sync_status: appointment.sync_status,
      display_date: displayDate,
      display_time: displayTime,
      appointment_at: appointment.appointment_at,
      appointment_end_at: appointment.appointment_end_at,
      cancelled_at: appointment.cancelled_at,
      rescheduled_at: appointment.rescheduled_at,
      original_appointment_at: appointment.original_appointment_at,
      external_booking_id: appointment.external_booking_id,
    },
    customer: customer ? {
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
    } : null,
  });
}
