'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { canUpload, login, register } from '@/lib/client/auth';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get('verified') ? 'Email verified. You can sign in now.' : null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        const user = await login(email, password);
        router.push(params.get('next') ?? (canUpload(user) ? '/upload' : '/'));
      } else {
        await register(name, email, password);
        setNotice('Account created. Open the verification link sent to your email, then sign in. (Running locally without email set up, the link is printed in the API server terminal.)');
        setMode('signin');
        setPassword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="page-head">
        <div className="shell-narrow" style={{ maxWidth: 460 }}>
          <p className="eyebrow">Account</p>
          <h1>{mode === 'signin' ? 'Sign in' : 'Create an account'}</h1>
          <p className="lead" style={{ marginTop: 8 }}>
            Searching is open to everyone. An account with an @msrit.edu address lets you upload papers once a moderator
            gives you uploader access.
          </p>

          <div className="row gap-6" style={{ marginTop: 24 }} role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={`btn btn-sm ${mode === 'signin' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('signin')}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={`btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('register')}>
              Register
            </button>
          </div>

          {notice && <p className="notice" style={{ marginTop: 18 }}>{notice}</p>}

          <form className="panel panel-pad stack gap-16" style={{ marginTop: 18 }} onSubmit={onSubmit}>
            {mode === 'register' && (
              <label className="stack gap-6">
                <span className="label">Name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
              </label>
            )}
            <label className="stack gap-6">
              <span className="label">College email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="1ms24ci000@msrit.edu" autoComplete="email" />
            </label>
            <label className="stack gap-6">
              <span className="label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : 1}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </label>
            {error && <p className="small" style={{ color: 'var(--negative)' }} role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="xs muted" style={{ marginTop: 16 }}>
            Sessions use a short-lived access token kept in memory and a refresh token in an httpOnly cookie. <Link href="/about">How it works</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
