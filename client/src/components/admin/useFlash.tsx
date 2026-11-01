'use client';

import { useCallback, useState, type ReactNode } from 'react';

/** Runs a dashboard action and shows its outcome (or its error) as a status line. */
export function useFlash() {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const run = useCallback(async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      setMsg(success ? { kind: 'ok', text: success } : null);
      return true;
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
      return false;
    }
  }, []);
  const flash: ReactNode = msg && (
    <p className={`dash-flash ${msg.kind}`} role={msg.kind === 'err' ? 'alert' : 'status'}>
      {msg.text}
    </p>
  );
  return { flash, run };
}
