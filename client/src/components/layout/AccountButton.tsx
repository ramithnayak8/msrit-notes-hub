'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { canUpload, logout, refreshSession, useAuth } from '@/lib/client/auth';

/** Restores the session from the refresh cookie once per page load. */
function useSessionRestore() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void refreshSession();
  }, []);
}

/** Sign in, or the signed-in user's upload link and sign out. */
export function AccountButton() {
  useSessionRestore();
  const { user, ready } = useAuth();

  if (!ready) return <span className="icon-btn" aria-hidden style={{ opacity: 0.4 }}><Icon name="user" /></span>;
  if (!user)
    return (
      <Link href="/login" className="btn btn-outline btn-sm" title="Sign in">
        <Icon name="user" size={16} /> Sign in
      </Link>
    );
  return (
    <span className="row gap-6">
      {canUpload(user) && (
        <Link href="/upload" className="icon-btn" title="Upload a paper" aria-label="Upload a paper">
          <Icon name="upload" />
        </Link>
      )}
      <button
        type="button"
        className="btn btn-quiet btn-sm"
        title={`Signed in as ${user.email} (${user.role}). Click to sign out.`}
        onClick={() => void logout()}
      >
        <Icon name="user" size={16} /> {user.name.split(' ')[0]}
      </button>
    </span>
  );
}
