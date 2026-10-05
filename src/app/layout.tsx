import type { Metadata } from 'next';
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Masthead } from '@/components/Masthead';
import { Footer } from '@/components/Footer';
import './globals.css';

const display = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ConceptQuery — Topic-aware retrieval for previous year question papers',
  description:
    'A topic-aware semantic retrieval platform for previous year question papers and academic notes at Ramaiah Institute of Technology — search by concept, with citation to the source paper, year and question number.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Masthead />
        {children}
        <Footer />
      </body>
    </html>
  );
}
