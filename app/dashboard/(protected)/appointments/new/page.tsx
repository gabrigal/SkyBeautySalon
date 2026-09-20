import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import NewAppointmentForm from './NewAppointmentForm';

export default async function NewAppointmentPage() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/dashboard/appointments"
            className="text-xs tracking-widest uppercase text-[#777777] hover:text-[#000000] transition-colors"
          >
            ← All Appointments
          </Link>
          <h1 className="text-2xl font-serif text-[#000000] mt-1">New Appointment</h1>
        </div>
      </div>
      <NewAppointmentForm />
    </div>
  );
}
