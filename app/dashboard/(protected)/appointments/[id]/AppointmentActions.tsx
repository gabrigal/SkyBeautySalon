'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  appointmentId: string;
}

export default function AppointmentActions({ appointmentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'complete' | 'no_show' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: 'complete' | 'no_show') {
    const label = action === 'complete' ? 'completed' : 'no-show';
    if (!window.confirm(`Mark this appointment as ${label}? This cannot be undone.`)) return;

    setLoading(action);
    setError(null);

    const endpoint = action === 'complete'
      ? `/api/appointments/${appointmentId}/complete`
      : `/api/appointments/${appointmentId}/no-show`;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white border border-[#DDDDDD] p-6 mb-6">
      <h2 className="text-[10px] tracking-widest uppercase text-[#777777] mb-4">Staff Actions</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handleAction('complete')}
          disabled={loading !== null}
          className="px-4 py-2 text-xs tracking-widest uppercase bg-[#000000] text-white hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'complete' ? 'Saving…' : 'Mark Completed'}
        </button>
        <button
          onClick={() => handleAction('no_show')}
          disabled={loading !== null}
          className="px-4 py-2 text-xs tracking-widest uppercase border border-[#DDDDDD] text-[#777777] hover:border-[#000000] hover:text-[#000000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'no_show' ? 'Saving…' : 'Mark No-Show'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-3">{error}</p>
      )}
    </div>
  );
}
