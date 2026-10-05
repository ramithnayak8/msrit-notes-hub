'use client';

import { Component, type ReactNode } from 'react';

/** Swallows render errors from decorative subtrees (e.g. a WebGL context that fails to start). */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[decorative layer disabled]', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
