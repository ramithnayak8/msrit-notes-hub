import { SearchBox, ExampleQueries } from '@/components/SearchBox';
import { HeroBackdrop } from './HeroBackdrop';
import { IntroLoader } from './IntroLoader';

const rise = (i: number) => ({ '--i': i }) as React.CSSProperties;

/**
 * Landing hero. Always rendered on the night palette (`on-dark`) because the
 * scene behind it is a night library, whichever theme the rest of the site uses.
 */
export function Hero({ examples }: { examples: string[] }) {
  return (
    <>
      {/* Outside the section: the hero's isolation would trap its z-index under the masthead. */}
      <IntroLoader />
      <section className="hero on-dark" aria-labelledby="hero-title">
        <HeroBackdrop />

        <div className="hero-inner shell">
          <div className="hero-copy">
            <p className="eyebrow hero-rise" style={rise(0)}>
              Ramaiah Institute of Technology
            </p>
            <h1 id="hero-title" className="hero-title hero-rise" style={rise(1)}>
              Pull up a chair.
              <br />
              <em>The library is open.</em>
            </h1>
            <p className="lead hero-lead hero-rise" style={rise(2)}>
              Every previous year paper, note set and syllabus scheme in one quiet place, searchable
              by what a question is <em>about</em>. Ask in plain English and get the exact
              questions, cited to their paper, year and question number.
            </p>
            <div className="hero-search hero-rise" style={rise(3)}>
              <SearchBox large />
              <div style={{ marginTop: 14 }}>
                <ExampleQueries queries={examples} />
              </div>
            </div>
          </div>
        </div>

        <a href="#archive" className="hero-scroll" aria-label="Scroll to the archive">
          <span className="hero-scroll-line" aria-hidden />
          <span className="label">Scroll</span>
        </a>
      </section>
    </>
  );
}
