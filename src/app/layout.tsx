import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google';
import { Masthead } from '@/components/layout/Masthead';
import { Footer } from '@/components/layout/Footer';
import { StudyRoomProvider } from '@/components/study/StudyRoomProvider';
import { StudyRoomPanel } from '@/components/study/StudyRoomPanel';
import { BOOT_SCRIPT } from '@/lib/client/prefs';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const reading = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-reading',
  display: 'swap',
  preload: false,
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

const description =
  'Previous year question papers, notes and syllabus schemes for Ramaiah Institute of Technology, searchable by concept. Ask in plain English and get the exact questions, cited to their paper, year and question number.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'ConceptQuery: a study archive for MSRIT past papers',
    template: '%s · ConceptQuery',
  },
  description,
  applicationName: 'ConceptQuery',
  openGraph: {
    type: 'website',
    siteName: 'ConceptQuery',
    title: 'ConceptQuery: a study archive for MSRIT past papers',
    description,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ConceptQuery: a study archive for MSRIT past papers',
    description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b1020' },
    { media: '(prefers-color-scheme: light)', color: '#0b1020' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${body.variable} ${reading.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <StudyRoomProvider>
          <div className="site">
            <Masthead />
            <div id="main" tabIndex={-1} className="site-main">
              {children}
            </div>
            <Footer />
          </div>
          <StudyRoomPanel />
        </StudyRoomProvider>
      </body>
    </html>
  );
}
