'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const SALON_TZ = 'America/New_York';

const STATUS_COLORS: Record<string, string> = {
  booked:    'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show:   'bg-red-100 text-red-700',
  pending:   'bg-yellow-100 text-yellow-800',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CalendarAppointment {
  id: string;
  service: string;
  appointment_status: string;
  appointment_at: string;
  customers: { first_name: string; last_name: string } | null;
}

interface Props {
  year: number;
  month: number; // 1-based
  appointments: CalendarAppointment[];
}

function toLocalDate(iso: string): { date: number; month: number; year: number; time: string } {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-US', { timeZone: SALON_TZ, year: 'numeric', month: 'numeric', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { timeZone: SALON_TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  const [m, day, yr] = dateStr.split('/').map(Number);
  return { date: day, month: m, year: yr, time: timeStr };
}

export default function CalendarView({ year, month, appointments }: Props) {
  const router = useRouter();

  function navigate(dir: number) {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    router.push(`/dashboard/calendar?year=${y}&month=${m}`);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  // Group appointments by local date
  const byDay: Record<number, CalendarAppointment[]> = {};
  for (const appt of appointments) {
    const local = toLocalDate(appt.appointment_at);
    if (local.month === month && local.year === year) {
      (byDay[local.date] = byDay[local.date] || []).push(appt);
    }
  }

  // Today in salon tz
  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: SALON_TZ, year: 'numeric', month: 'numeric', day: 'numeric' });
  const [todayM, todayD, todayY] = todayStr.split('/').map(Number);
  const todayDate = todayY === year && todayM === month ? todayD : -1;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 md:p-8 text-[#000000]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <h1 className="text-2xl font-serif text-[#000000]">Calendar</h1>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* Month + year — large and always visible */}
          <span className="text-lg font-serif text-[#000000] order-first sm:order-none whitespace-nowrap">
            {monthLabel}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center border border-[#DDDDDD] hover:border-[#000000] hover:bg-[#000000] hover:text-white text-[#000000] transition-colors text-lg leading-none"
              aria-label="Previous month"
            >
              &#8592;
            </button>
            <button
              onClick={() => navigate(1)}
              className="w-9 h-9 flex items-center justify-center border border-[#DDDDDD] hover:border-[#000000] hover:bg-[#000000] hover:text-white text-[#000000] transition-colors text-lg leading-none"
              aria-label="Next month"
            >
              &#8594;
            </button>
            <Link
              href={`/dashboard/calendar?year=${todayY}&month=${todayM}`}
              className="px-3 py-2 text-xs tracking-widest uppercase border border-[#DDDDDD] text-[#000000] hover:bg-[#000000] hover:text-white hover:border-[#000000] transition-colors"
            >
              Today
            </Link>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-[#DDDDDD] overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-[#DDDDDD]">
          {DOW.map(d => (
            <div key={d} className="py-2 text-center text-[10px] tracking-widest uppercase text-[#777777] font-normal">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - firstDay + 1;
            const isInMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const isToday = dayNum === todayDate;
            const dayAppts = isInMonth ? (byDay[dayNum] ?? []) : [];

            return (
              <div
                key={i}
                className={`min-h-[80px] md:min-h-[110px] p-1 md:p-2 border-r border-b border-[#EEEEEE] last:border-r-0 ${
                  !isInMonth ? 'bg-[#FAFAFA]' : ''
                }`}
              >
                {isInMonth && (
                  <>
                    {/* Day number */}
                    <div className={`text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-[#000000] text-white font-medium'
                        : 'text-[#000000]'
                    }`}>
                      {dayNum}
                    </div>

                    {/* Appointment pills */}
                    <div className="space-y-0.5">
                      {dayAppts.slice(0, 3).map(appt => {
                        const local = toLocalDate(appt.appointment_at);
                        const name = appt.customers
                          ? `${appt.customers.first_name} ${appt.customers.last_name}`
                          : '';
                        return (
                          <Link
                            key={appt.id}
                            href={`/dashboard/appointments/${appt.id}`}
                            className={`block rounded px-1 py-0.5 text-[10px] leading-tight truncate hover:opacity-80 transition-opacity ${
                              STATUS_COLORS[appt.appointment_status] ?? 'bg-gray-100 text-gray-600'
                            }`}
                            title={`${local.time} · ${appt.service} · ${name}`}
                          >
                            <span className="hidden sm:inline">{local.time} · </span>
                            <span className="font-medium">{name || appt.service}</span>
                          </Link>
                        );
                      })}
                      {dayAppts.length > 3 && (
                        <p className="text-[10px] text-[#777777] px-1">
                          +{dayAppts.length - 3} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4">
        {[
          { label: 'Booked',    color: 'bg-green-100 text-green-800' },
          { label: 'Completed', color: 'bg-blue-100 text-blue-800' },
          { label: 'No-show',   color: 'bg-red-100 text-red-700' },
          { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded ${color.split(' ')[0]}`} />
            <span className="text-xs text-[#777777]">{label}</span>
          </div>
        ))}
      </div>

      {/* Mobile: upcoming list for this month */}
      {appointments.length > 0 && (
        <div className="mt-6 sm:hidden">
          <h2 className="text-[10px] tracking-widest uppercase text-[#777777] mb-3">This Month</h2>
          <div className="bg-white border border-[#DDDDDD] divide-y divide-[#EEEEEE]">
            {appointments
              .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at))
              .map(appt => {
                const local = toLocalDate(appt.appointment_at);
                const name = appt.customers
                  ? `${appt.customers.first_name} ${appt.customers.last_name}`
                  : '—';
                return (
                  <Link
                    key={appt.id}
                    href={`/dashboard/appointments/${appt.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA]"
                  >
                    <div className="w-8 text-center shrink-0">
                      <p className="text-lg font-serif leading-none text-[#000000]">{local.date}</p>
                      <p className="text-[9px] text-[#777777] uppercase">{DOW[new Date(year, month-1, local.date).getDay()]}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#000000] truncate">{name}</p>
                      <p className="text-xs text-[#777777]">{appt.service} · {local.time}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 tracking-widest uppercase shrink-0 ${STATUS_COLORS[appt.appointment_status]}`}>
                      {appt.appointment_status.replace('_', ' ')}
                    </span>
                  </Link>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
