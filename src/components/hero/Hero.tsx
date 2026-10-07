import { SearchBox, ExampleQueries } from '@/components/SearchBox';
import { HeroBackdrop } from './HeroBackdrop';
import { IntroLoader } from './IntroLoader';

const rise = (i: number) => ({ '--i': i }) as React.CSSProperties;

/**
 * Landing hero. Always rendered on the night palette (`on-dark`) because the
 * scene behind it is a night library, whichever theme the rest of the site uses.
 */
export function Hero({ examples, paperCount }: { examples: string[]; paperCount: number }) {
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
              {paperCount.toLocaleString('en-IN')} past papers, notes and syllabus schemes in one quiet
              place. Search questions by what they are <em>about</em>, in plain English, and get the
              exact question cited to its paper, year and number.
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
