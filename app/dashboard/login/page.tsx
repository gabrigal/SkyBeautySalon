'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function makeAuthCookiesSessionOnly() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie.split(';').forEach(raw => {
    const eq = raw.indexOf('=');
    if (eq === -1) return;
    const name = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (name.startsWith('sb-') && name.includes('-auth-token')) {
      // Re-set without max-age → browser treats it as a session cookie
      document.cookie = `${name}=${value}; path=/; SameSite=Lax${secure}`;
    }
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    if (!rememberMe) {
      makeAuthCookiesSessionOnly();
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-2xl font-serif tracking-widest text-[#000000]">SKY BEAUTY</span>
          </div>
          <p className="text-xs tracking-widest text-[#777777] uppercase">Staff Portal</p>
        </div>

        <div className="bg-white border border-[#DDDDDD] p-8">
          <h1 className="text-lg font-serif text-[#000000] mb-6 text-center">Sign In</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs tracking-widest text-[#777777] uppercase mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-[#DDDDDD] px-4 py-2.5 text-sm text-[#000000] focus:outline-none focus:border-[#000000] bg-white"
              />
            </div>

            <div>
              <label className="block text-xs tracking-widest text-[#777777] uppercase mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border border-[#DDDDDD] px-4 py-2.5 text-sm text-[#000000] focus:outline-none focus:border-[#000000] bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 border border-[#DDDDDD] accent-black cursor-pointer"
              />
              <label
                htmlFor="rememberMe"
                className="text-xs text-[#777777] tracking-wide cursor-pointer select-none"
              >
                Remember me on this device
              </label>
            </div>

            {error && (
              <p className="text-xs text-red-600 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#000000] text-white text-xs tracking-widest uppercase py-3 hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
