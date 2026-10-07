import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study assistant',
  description: 'Ask what to revise. Answers come only from indexed papers and syllabus schemes, with sources cited.',
};

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return children;
}
