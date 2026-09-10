'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const SALON_TZ = 'America/New_York';
// Operating hours: 11am–5pm Sun, 11am–6pm Tue–Thu, 10am–6pm Fri–Sat. Closed Mon.
const SLOT_LABELS = [
  '10:00 AM','11:00 AM','11:30 AM',
  '12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM',
  '2:00 PM','2:30 PM',
  '3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM',
  '5:00 PM','5:30 PM',
];

type Step = 'loading' | 'view' | 'cancel-confirm' | 'cancel-done' | 'reschedule-date'
           | 'reschedule-time' | 'reschedule-confirm' | 'reschedule-done'
           | 'error' | 'not-found';

interface AppointmentData {
  id: string;
  service: string;
  stylist: string | null;
  appointment_status: string;
  sync_status: string;
  display_date: string;
  display_time: string;
  appointment_at: string;
  appointment_end_at: string;
  external_booking_id: string | null;
}

interface ManageData {
  appointment: AppointmentData;
  customer: { first_name: string; last_name: string; email: string | null } | null;
}

function toLocalDate(utcISO: string): Date {
  return new Date(utcISO);
}

function formatDateLocal(d: Date): string {
  return d.toLocaleDateString('en-US', {
    timeZone: SALON_TZ,
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function slotToUTC(dateISO: string, slotLabel: string, durationMins: number): { start: string; end: string } {
  const hour24 = slotLabelTo24(slotLabel);
  const [y, m, d] = dateISO.split('-').map(Number);
  const isDST = isEasternDST(y, m, d);
  const offset = isDST ? '-04:00' : '-05:00';
  const pad = (n: number) => String(n).padStart(2, '0');
  const startStr = `${dateISO}T${pad(hour24.h)}:${pad(hour24.m)}:00${offset}`;
  const startMs = new Date(startStr).getTime();
  const endMs = startMs + durationMins * 60_000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

function slotLabelTo24(label: string): { h: number; m: number } {
  const [timePart, ampm] = label.split(' ');
  const [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr);
  const m = parseInt(mStr);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, m };
}

function isEasternDST(year: number, month: number, day: number): boolean {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  const firstOfMonth = new Date(year, month - 1, 1).getDay();
  if (month === 3) return day >= 1 + (7 - firstOfMonth) % 7 + 7;
  return day < 1 + (7 - firstOfMonth) % 7;
}

function getDurationMins(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

export default function ManagePage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action');

  const [step, setStep] = useState<Step>('loading');
  const [data, setData] = useState<ManageData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [takenSlots, setTakenSlots] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch appointment data on mount
  useEffect(() => {
    fetch(`/api/manage/${token}`)
      .then(async res => {
        if (res.status === 404) { setStep('not-found'); return; }
        if (!res.ok) { setStep('error'); setErrorMsg('Failed to load appointment.'); return; }
        const json: ManageData = await res.json();
        setData(json);
        if (json.appointment.appointment_status === 'cancelled') {
          setStep('cancel-done');
        } else if (initialAction === 'cancel') {
          setStep('cancel-confirm');
        } else if (initialAction === 'reschedule') {
          setStep('reschedule-date');
        } else {
          setStep('view');
        }
      })
      .catch(() => { setStep('error'); setErrorMsg('Network error. Please try again.'); });
  }, [token, initialAction]);

  // Fetch availability when date is selected
  const fetchAvailability = useCallback(async (date: Date) => {
    setLoadingSlots(true);
    setTakenSlots(new Set());
    try {
      const dateISO = dateToISO(date);
      const res = await fetch(`/api/availability/reschedule?token=${token}&date=${dateISO}`);
      if (res.ok) {
        const json = await res.json();
        setTakenSlots(new Set(json.taken ?? []));
      }
    } catch {
      // If fetch fails, show all slots
    } finally {
      setLoadingSlots(false);
    }
  }, [token]);

  useEffect(() => {
    if (step === 'reschedule-time' && selectedDate) {
      fetchAvailability(selectedDate);
    }
  }, [step, selectedDate, fetchAvailability]);

  async function handleCancel() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/manage/${token}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (res.ok || res.status === 202) {
        setStep('cancel-done');
      } else {
        setErrorMsg(json.error ?? 'Cancellation failed.');
        setStep('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReschedule() {
    if (!selectedDate || !selectedSlot || !data) return;
    setSubmitting(true);
    try {
      const durationMins = getDurationMins(data.appointment.appointment_at, data.appointment.appointment_end_at);
      const dateISO = dateToISO(selectedDate);
      const { start: newStartISO, end: newEndISO } = slotToUTC(dateISO, selectedSlot, durationMins);

      const res = await fetch(`/api/manage/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStartISO, newEndISO, token }),
      });
      const json = await res.json();
      if (res.ok || res.status === 202) {
        setStep('reschedule-done');
      } else {
        setErrorMsg(json.error ?? 'Reschedule failed.');
        setStep('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  }

  // Date picker: next 60 days, skip Mondays
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 1; i <= 60 && dates.length < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const tz = d.toLocaleDateString('en-US', { timeZone: SALON_TZ, weekday: 'short' });
    if (tz !== 'Mon') dates.push(d);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-xl font-serif tracking-widest text-[#000000]">SKY BEAUTY</span>
          <p className="text-[10px] tracking-widest text-[#777777] uppercase mt-1">Appointment Management</p>
        </div>

        <div className="bg-white border border-[#DDDDDD] p-8">
          {step === 'loading' && (
            <p className="text-center text-sm text-[#777777]">Loading your appointment…</p>
          )}

          {step === 'not-found' && (
            <div className="text-center">
              <p className="text-sm text-[#777777]">This appointment link is invalid or has expired.</p>
              <p className="text-xs text-[#999999] mt-2">Please contact us if you need help.</p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center">
              <p className="text-sm text-red-600 mb-2">{errorMsg}</p>
              <button onClick={() => setStep('view')} className="text-xs tracking-widest uppercase text-[#000000] underline">
                Back
              </button>
            </div>
          )}

          {step === 'view' && data && (
            <div>
              <h2 className="text-lg font-serif text-[#000000] mb-1">{data.appointment.service}</h2>
              <p className="text-sm text-[#777777] mb-1">{data.appointment.stylist}</p>
              <p className="text-sm text-[#000000] mb-4">
                {data.appointment.display_date} at {data.appointment.display_time}
              </p>
              {data.customer && (
                <p className="text-xs text-[#777777] mb-6">
                  {data.customer.first_name} {data.customer.last_name}
                  {data.customer.email ? ` · ${data.customer.email}` : ''}
                </p>
              )}
              <div className="space-y-3">
                <button
                  onClick={() => setStep('reschedule-date')}
                  className="w-full border border-[#000000] text-[#000000] text-xs tracking-widest uppercase py-3 hover:bg-[#000000] hover:text-white transition-colors"
                >
                  Reschedule Appointment
                </button>
                <button
                  onClick={() => setStep('cancel-confirm')}
                  className="w-full border border-[#DDDDDD] text-[#777777] text-xs tracking-widest uppercase py-3 hover:border-red-400 hover:text-red-600 transition-colors"
                >
                  Cancel Appointment
                </button>
              </div>
            </div>
          )}

          {step === 'cancel-confirm' && data && (
            <div>
              <h2 className="text-lg font-serif text-[#000000] mb-4">Cancel Appointment?</h2>
              <p className="text-sm text-[#777777] mb-2">{data.appointment.service}</p>
              <p className="text-sm text-[#000000] mb-6">
                {data.appointment.display_date} at {data.appointment.display_time}
              </p>
              <p className="text-xs text-[#777777] mb-6">
                This action cannot be undone. You will receive a cancellation confirmation.
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="w-full bg-red-600 text-white text-xs tracking-widest uppercase py-3 hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Cancelling…' : 'Yes, Cancel Appointment'}
                </button>
                <button
                  onClick={() => setStep('view')}
                  className="w-full border border-[#DDDDDD] text-[#777777] text-xs tracking-widest uppercase py-3 hover:border-[#000000] hover:text-[#000000] transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}

          {step === 'cancel-done' && (
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#000000] flex items-center justify-center mx-auto mb-4">
                <span className="text-xl">✓</span>
              </div>
              <h2 className="text-lg font-serif text-[#000000] mb-2">Appointment Cancelled</h2>
              <p className="text-sm text-[#777777]">
                Your appointment has been cancelled. We hope to see you again soon.
              </p>
            </div>
          )}

          {step === 'reschedule-date' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('view')} className="text-xs text-[#777777] hover:text-[#000000] tracking-widest uppercase">
                  ← Back
                </button>
                <h2 className="text-lg font-serif text-[#000000]">Select a New Date</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {dates.map((d, i) => {
                  const dayStr = d.toLocaleDateString('en-US', { timeZone: SALON_TZ, weekday: 'short' });
                  const dateStr = d.toLocaleDateString('en-US', { timeZone: SALON_TZ, month: 'short', day: 'numeric' });
                  const isSelected = selectedDate && dateToISO(d) === dateToISO(selectedDate);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedSlot(null);
                        setStep('reschedule-time');
                      }}
                      className={`border p-3 text-center transition-colors ${
                        isSelected
                          ? 'bg-[#000000] text-white border-[#000000]'
                          : 'border-[#DDDDDD] text-[#000000] hover:border-[#000000]'
                      }`}
                    >
                      <p className="text-[10px] tracking-widest uppercase text-inherit opacity-70">{dayStr}</p>
                      <p className="text-sm font-medium">{dateStr}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'reschedule-time' && selectedDate && data && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep('reschedule-date')} className="text-xs text-[#777777] hover:text-[#000000] tracking-widest uppercase">
                  ← Back
                </button>
              </div>
              <h2 className="text-lg font-serif text-[#000000] mb-1">Select a Time</h2>
              <p className="text-xs text-[#777777] mb-4">{formatDateLocal(selectedDate)}</p>

              {loadingSlots ? (
                <p className="text-center text-sm text-[#777777] py-4">Checking availability…</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {SLOT_LABELS.map(slot => {
                    const isTaken = takenSlots.has(slot);
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => !isTaken && setSelectedSlot(slot)}
                        disabled={isTaken}
                        className={`border p-2 text-xs transition-colors ${
                          isTaken
                            ? 'border-[#EEEEEE] text-[#CCCCCC] cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-[#000000] text-white border-[#000000]'
                            : 'border-[#DDDDDD] text-[#000000] hover:border-[#000000]'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => selectedSlot && setStep('reschedule-confirm')}
                disabled={!selectedSlot}
                className="w-full bg-[#000000] text-white text-xs tracking-widest uppercase py-3 disabled:opacity-30 hover:bg-[#333333] transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'reschedule-confirm' && selectedDate && selectedSlot && data && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('reschedule-time')} className="text-xs text-[#777777] hover:text-[#000000] tracking-widest uppercase">
                  ← Back
                </button>
                <h2 className="text-lg font-serif text-[#000000]">Confirm Reschedule</h2>
              </div>
              <div className="bg-[#F8F8F8] border border-[#EEEEEE] p-4 mb-6">
                <p className="text-xs text-[#777777] uppercase tracking-widest mb-1">New appointment</p>
                <p className="text-sm font-medium text-[#000000]">{data.appointment.service}</p>
                <p className="text-sm text-[#000000]">{formatDateLocal(selectedDate)}</p>
                <p className="text-sm text-[#000000]">{selectedSlot}</p>
              </div>
              <button
                onClick={handleReschedule}
                disabled={submitting}
                className="w-full bg-[#000000] text-white text-xs tracking-widest uppercase py-3 disabled:opacity-50 hover:bg-[#333333] transition-colors"
              >
                {submitting ? 'Confirming…' : 'Confirm Reschedule'}
              </button>
            </div>
          )}

          {step === 'reschedule-done' && selectedDate && selectedSlot && data && (
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#000000] flex items-center justify-center mx-auto mb-4">
                <span className="text-xl">✓</span>
              </div>
              <h2 className="text-lg font-serif text-[#000000] mb-2">Appointment Rescheduled</h2>
              <p className="text-sm text-[#777777]">
                Your appointment has been moved to {formatDateLocal(selectedDate)} at {selectedSlot}.
                You will receive a confirmation email shortly.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#999999] mt-6">
          Questions? Call or text us directly.
        </p>
      </div>
    </div>
  );
}
