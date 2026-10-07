import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My shelf',
  description: 'Your saved questions, saved courses, recently opened courses and study streak.',
  robots: { index: false },
};

export default function ShelfLayout({ children }: { children: React.ReactNode }) {
  return children;
}
