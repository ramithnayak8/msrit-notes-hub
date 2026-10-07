'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Icon, type IconName } from '@/components/ui/Icon';
import { bestScore } from '@/lib/client/fuzzy';
import { THEMES } from '@/lib/client/prefs';
import { SCENES } from '@/components/ambience/scenes';
import type { QuestionHit } from '@/lib/types';
import { useStudyRoom } from './StudyRoomProvider';

type Catalog = {
  departments: { code: string; name: string; fullName: string; courses: number }[];
  courses: { code: string; title: string; dept: string; semester: number }[];
};

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
};

let catalogCache: Catalog | null = null;

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** Ctrl/Cmd+K (or "/") from anywhere: jump to any course, branch, page or setting. */
export function CommandPalette() {
  const router = useRouter();
  const { overlay, open, close, setPref, sound, setSound } = useStudyRoom();
  const isOpen = overlay === 'palette';
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [catalog, setCatalog] = useState<Catalog | null>(catalogCache);
  const [hits, setHits] = useState<QuestionHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (isOpen) close();
        else open('palette');
      } else if (event.key === '/' && !overlay && !isTypingTarget(event.target)) {
        event.preventDefault();
        open('palette');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, overlay, open, close]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActive(0);
    setHits([]);
    if (!catalogCache) {
      fetch('/api/catalog')
        .then((r) => r.json())
        .then((data: Catalog) => {
          catalogCache = data;
          setCatalog(data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Live question matches from the existing search API, debounced.
  useEffect(() => {
    const q = query.trim();
    if (!isOpen || q.length < 3) {
      setHits([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const id = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=4`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setHits(Array.isArray(data.hits) ? data.hits : []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 220);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [query, isOpen]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const commands = useMemo<Item[]>(
    () => [
      { id: 'p-search', group: 'Go to', label: 'Search questions', icon: 'search', run: () => go('/search') },
      { id: 'p-branches', group: 'Go to', label: 'Browse branches', icon: 'library', run: () => go('/departments') },
      { id: 'p-syllabus', group: 'Go to', label: 'Syllabus changes', icon: 'diff', run: () => go('/syllabus') },
      { id: 'p-assistant', group: 'Go to', label: 'Study assistant', icon: 'message', run: () => go('/assistant') },
      { id: 'p-shelf', group: 'Go to', label: 'My shelf: saved questions and streak', icon: 'bookmark', run: () => go('/shelf') },
      { id: 'p-home', group: 'Go to', label: 'Home', icon: 'home', run: () => go('/') },
      { id: 'p-about', group: 'Go to', label: 'About this archive', icon: 'info', run: () => go('/about') },
      { id: 'a-focus', group: 'Study room', label: 'Focus timer (Pomodoro)', icon: 'timer', run: () => open('focus') },
      { id: 'a-room', group: 'Study room', label: 'Theme, ambience and effects', icon: 'sliders', run: () => open('room') },
      {
        id: 'a-sound',
        group: 'Study room',
        label: sound ? 'Turn ambient sound off' : 'Turn ambient sound on',
        icon: sound ? 'volumeOff' : 'volume',
        run: () => {
          setSound(!sound);
          close();
        },
      },
      ...SCENES.map<Item>((scene) => ({
        id: `s-${scene.id}`,
        group: 'Study room',
        label: `Ambience: ${scene.label}`,
        hint: scene.hint,
        icon: 'sparkles',
        run: () => {
          setPref('ambience', scene.id);
          close();
        },
      })),
      ...THEMES.map((theme) => ({
        id: `t-${theme.id}`,
        group: 'Study room',
        label: `Theme: ${theme.label}`,
        icon: (theme.id === 'dark' ? 'moon' : 'sun') as IconName,
        run: () => {
          setPref('theme', theme.id);
          close();
        },
      })),
    ],
    [go, open, close, setPref, sound, setSound]
  );

  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    if (!q) return commands;

    const score = <T,>(list: T[], fields: (x: T) => string[]) =>
      list
        .map((x) => ({ x, score: bestScore(q, fields(x)) }))
        .filter((r): r is { x: T; score: number } => r.score !== null)
        .sort((a, b) => b.score - a.score);

    const scoredCourses = score(catalog?.courses ?? [], (c) => [c.code, c.title]);
    const scoredBranches = score((catalog?.departments ?? []).filter((d) => d.courses > 0), (d) => [d.code, d.name, d.fullName]);
    const scoredCommands = score(commands, (c) => [c.label]);

    // Once anything contains the query as written, scattered letter matches are noise.
    const CONTIGUOUS = 500;
    const best = Math.max(...[scoredCourses, scoredBranches, scoredCommands].map((l) => l[0]?.score ?? 0));
    const rank = <T,>(list: { x: T; score: number }[], limit: number) =>
      list.filter((r) => best < CONTIGUOUS || r.score >= CONTIGUOUS).slice(0, limit).map((r) => r.x);

    const courses = rank(scoredCourses, 5).map<Item>((c) => ({
      id: `c-${c.code}`,
      group: 'Courses',
      label: c.title,
      hint: `${c.code} · ${c.dept} · Sem ${c.semester}`,
      icon: 'book',
      run: () => go(`/courses/${c.code}`),
    }));
    const branches = rank(scoredBranches, 3).map<Item>((d) => ({
      id: `d-${d.code}`,
      group: 'Branches',
      label: d.fullName,
      hint: `${d.courses} courses`,
      icon: 'library',
      run: () => go(`/departments/${d.code}`),
    }));
    const search: Item[] = [
      { id: 's-search', group: 'Search', label: `Search all questions for “${q}”`, icon: 'search', run: () => go(`/search?q=${encodeURIComponent(q)}`) },
      { id: 's-ask', group: 'Search', label: `Ask the assistant “${q}”`, icon: 'message', run: () => go(`/assistant?q=${encodeURIComponent(q)}`) },
    ];
    const questions = hits.map<Item>((h) => ({
      id: `q-${h.id}`,
      group: 'Questions',
      label: h.text.length > 90 ? `${h.text.slice(0, 88)}…` : h.text,
      hint: `${h.courseCode} · ${h.month} ${h.year} · Q${h.number}`,
      icon: 'file',
      run: () => go(`/courses/${h.courseCode}#q-${h.id}`),
    }));
    const pages = rank(scoredCommands, 5);
    // A command that matches better than every course goes first ("rain" -> Rainy window).
    const commandsFirst = (scoredCommands[0]?.score ?? 0) > Math.max(scoredCourses[0]?.score ?? 0, scoredBranches[0]?.score ?? 0);

    return commandsFirst
      ? [...pages, ...courses, ...branches, ...search, ...questions]
      : [...courses, ...branches, ...search, ...questions, ...pages];
  }, [query, catalog, hits, commands, go]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    document.getElementById(`cmd-${items[active]?.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, items]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (!items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      items[active]?.run();
    }
  }

  let lastGroup = '';

  return (
    <Sheet open={isOpen} onClose={close} label="Command palette" className="sheet-palette">
      <div className="palette-input">
        <Icon name="search" size={20} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a course, branch or topic…"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
          aria-label="Search commands, courses and questions"
          autoComplete="off"
          spellCheck={false}
        />
        {searching ? <span className="spinner" aria-label="Searching" /> : <span className="kbd">Esc</span>}
      </div>

      <ul id="cmd-list" className="palette-list" role="listbox" aria-label="Results">
        {items.map((item, index) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.id} role="presentation">
              {header && <div className="palette-group" role="presentation">{header}</div>}
              <div
                id={`cmd-${item.id}`}
                role="option"
                aria-selected={index === active}
                className="palette-item"
                onMouseMove={() => setActive(index)}
                onClick={item.run}
              >
                <Icon name={item.icon} size={17} />
                <span className="palette-label">{item.label}</span>
                {item.hint && <span className="palette-hint">{item.hint}</span>}
              </div>
            </li>
          );
        })}
        {query.trim() && items.length === 0 && <li className="palette-empty">No matches.</li>}
      </ul>

      <div className="palette-foot" aria-hidden>
        <span><span className="kbd">↑</span> <span className="kbd">↓</span> move</span>
        <span><span className="kbd">Enter</span> open</span>
        <span><span className="kbd">/</span> or <span className="kbd">Ctrl K</span> anywhere</span>
      </div>
    </Sheet>
  );
}
