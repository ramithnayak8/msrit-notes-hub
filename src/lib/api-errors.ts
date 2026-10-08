import { NextResponse } from 'next/server';
import { BackendError } from './data';

/**
 * Wraps an API route so a failing backend answers 502 with a JSON reason,
 * instead of a bare 500, and a backend 404 stays a 404.
 */
export function withBackendErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof BackendError) {
        console.error(`[api] ${err.message}`);
        const status = err.status === 404 ? 404 : 502;
        return NextResponse.json({ error: 'The archive backend is unavailable. Try again shortly.', detail: err.message }, { status });
      }
      throw err;
    }
  };
}
