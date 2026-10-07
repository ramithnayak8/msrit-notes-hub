import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search questions',
  description: 'Search every indexed previous year question by topic, course, year or marks, in plain English.',
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
