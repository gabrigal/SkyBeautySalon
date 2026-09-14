import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { ServiceRetentionRule } from '@/lib/database.types';
import RetentionRulesClient from './RetentionRulesClient';

const BUSINESS_ID = process.env.SALON_BUSINESS_ID!;

export default async function RetentionSettingsPage() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawRules } = await (supabase as any)
    .from('service_retention_rules')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .order('service_name', { ascending: true });

  const rules = (rawRules ?? []) as ServiceRetentionRule[];

  // Fetch the distinct services from completed appointments to show unstratified services
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawServices } = await (supabase as any)
    .from('appointments')
    .select('service')
    .eq('business_id', BUSINESS_ID)
    .eq('appointment_status', 'completed');

  type SvcRow = { service: string };
  const configuredNames = new Set(rules.map(r => r.service_name.toLowerCase()));
  const allServiceNames: string[] = (rawServices ?? []).map((r: SvcRow) => r.service as string);
  const unconfiguredServices = [...new Set(allServiceNames)]
    .filter(s => !configuredNames.has(s.toLowerCase()))
    .sort();

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-2xl font-serif text-[#000000] mb-2">Retention Rules</h1>
      <p className="text-sm text-[#777777] mb-8">
        Configure return intervals per service. When an appointment is completed, the system will
        automatically schedule a rebooking reminder and optionally a reactivation message based on
        these rules.
      </p>

      <RetentionRulesClient rules={rules} />

      {/* Services without rules */}
      {unconfiguredServices.length > 0 && (
        <div className="mt-8 bg-amber-50 border border-amber-200 p-6">
          <h2 className="text-[10px] tracking-widest uppercase text-amber-700 mb-3">Services Needing Rules</h2>
          <p className="text-xs text-amber-700 mb-3">
            These services have completed appointments but no retention rule configured. Customers
            who received these services will not receive rebooking reminders.
          </p>
          <div className="flex flex-wrap gap-2">
            {unconfiguredServices.map(svc => (
              <span key={svc} className="px-3 py-1 text-xs border border-amber-300 text-amber-800 bg-white">
                {svc}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
