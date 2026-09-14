'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ServiceRetentionRule } from '@/lib/database.types';

interface Props {
  rules: ServiceRetentionRule[];
}

export default function RetentionRulesClient({ rules: initialRules }: Props) {
  const router = useRouter();
  const [rules, setRules] = useState<ServiceRetentionRule[]>(initialRules);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ service_name: '', rebook_after_days: '', reactivation_after_days: '' });
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addRule() {
    const rebookDays = parseInt(newForm.rebook_after_days, 10);
    if (!newForm.service_name.trim() || !rebookDays || rebookDays < 1) {
      setError('Service name and a positive rebook interval are required.');
      return;
    }
    const reactivDays = newForm.reactivation_after_days ? parseInt(newForm.reactivation_after_days, 10) : null;
    if (reactivDays != null && reactivDays < 1) {
      setError('Reactivation interval must be positive if provided.');
      return;
    }
    setLoading('add');
    setError(null);
    try {
      const res = await fetch('/api/dashboard/retention-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: newForm.service_name.trim(),
          rebook_after_days: rebookDays,
          reactivation_after_days: reactivDays,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to add rule.');
        return;
      }
      setAdding(false);
      setNewForm({ service_name: '', rebook_after_days: '', reactivation_after_days: '' });
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function toggleEnabled(rule: ServiceRetentionRule) {
    setLoading(rule.id);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/retention-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to update rule.');
        return;
      }
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function deleteRule(rule: ServiceRetentionRule) {
    if (!window.confirm(`Delete rule for "${rule.service_name}"? Existing scheduled jobs will not be affected.`)) return;
    setLoading(rule.id);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/retention-rules/${rule.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to delete rule.');
        return;
      }
      setRules(prev => prev.filter(r => r.id !== rule.id));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Rules table */}
      <div className="bg-white border border-[#DDDDDD] mb-6">
        {rules.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-[#777777] mb-2">No retention rules configured yet.</p>
            <p className="text-xs text-[#999999]">
              Add a rule for each service to enable rebooking reminders and reactivation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-[#F8F8F8] border-b border-[#DDDDDD]">
                <tr>
                  <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-6 py-3 font-normal">Service</th>
                  <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-6 py-3 font-normal">Rebook After</th>
                  <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-6 py-3 font-normal">Reactivation After</th>
                  <th className="text-left text-[10px] tracking-widest uppercase text-[#777777] px-6 py-3 font-normal">Status</th>
                  <th className="px-6 py-3 font-normal"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE]">
                {rules.map(rule => (
                  <tr key={rule.id} className={rule.enabled ? '' : 'opacity-50'}>
                    <td className="px-6 py-3 text-[#000000] font-medium">{rule.service_name}</td>
                    <td className="px-6 py-3 text-[#777777]">{rule.rebook_after_days} days</td>
                    <td className="px-6 py-3 text-[#777777]">
                      {rule.reactivation_after_days != null ? `${rule.reactivation_after_days} days` : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-[10px] tracking-widest uppercase ${rule.enabled ? 'text-green-700' : 'text-[#999999]'}`}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => toggleEnabled(rule)}
                          disabled={loading === rule.id}
                          className="text-[10px] tracking-widest uppercase text-[#777777] hover:text-[#000000] disabled:opacity-50"
                        >
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteRule(rule)}
                          disabled={loading === rule.id}
                          className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add rule form */}
      {adding ? (
        <div className="bg-white border border-[#DDDDDD] p-6">
          <h3 className="text-[10px] tracking-widest uppercase text-[#777777] mb-4">Add Service Rule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#777777] mb-1">Service Name</label>
              <input
                type="text"
                value={newForm.service_name}
                onChange={e => setNewForm(p => ({ ...p, service_name: e.target.value }))}
                placeholder="e.g. Women's Haircut"
                className="w-full border border-[#DDDDDD] px-3 py-2 text-sm focus:outline-none focus:border-[#000000]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#777777] mb-1">Rebook After (days)</label>
              <input
                type="number"
                min="1"
                value={newForm.rebook_after_days}
                onChange={e => setNewForm(p => ({ ...p, rebook_after_days: e.target.value }))}
                placeholder="e.g. 42"
                className="w-full border border-[#DDDDDD] px-3 py-2 text-sm focus:outline-none focus:border-[#000000]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#777777] mb-1">Reactivation After (days, optional)</label>
              <input
                type="number"
                min="1"
                value={newForm.reactivation_after_days}
                onChange={e => setNewForm(p => ({ ...p, reactivation_after_days: e.target.value }))}
                placeholder="e.g. 120"
                className="w-full border border-[#DDDDDD] px-3 py-2 text-sm focus:outline-none focus:border-[#000000]"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={addRule}
              disabled={loading === 'add'}
              className="px-4 py-2 text-xs tracking-widest uppercase bg-[#000000] text-white hover:bg-[#333333] disabled:opacity-50"
            >
              {loading === 'add' ? 'Saving…' : 'Add Rule'}
            </button>
            <button
              onClick={() => { setAdding(false); setError(null); }}
              className="px-4 py-2 text-xs tracking-widest uppercase border border-[#DDDDDD] text-[#777777] hover:border-[#000000]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 text-xs tracking-widest uppercase border border-[#DDDDDD] text-[#000000] hover:bg-[#000000] hover:text-white transition-colors"
        >
          + Add Service Rule
        </button>
      )}
    </div>
  );
}
