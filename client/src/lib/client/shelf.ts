import { createStore } from './store';

/** Enough of a question to show it on the shelf without a round trip. */
export type SavedQuestion = {
  id: number;
  number: string;
  text: string;
  marks: number;
  courseCode: string;
  courseTitle: string;
  paper: string;
  savedAt: number;
};

export type SavedCourse = {
  code: string;
  title: string;
  dept: string;
  semester: number;
  at: number;
};

type Shelf = {
  questions: SavedQuestion[];
  courses: SavedCourse[];
  recent: SavedCourse[];
};

const RECENT_MAX = 8;

const store = createStore<Shelf>('cq:shelf', { questions: [], courses: [], recent: [] });

export const useShelf = store.use;

export function toggleQuestion(question: Omit<SavedQuestion, 'savedAt'>): void {
  store.set((shelf) => ({
    ...shelf,
    questions: shelf.questions.some((q) => q.id === question.id)
      ? shelf.questions.filter((q) => q.id !== question.id)
      : [{ ...question, savedAt: Date.now() }, ...shelf.questions],
  }));
}

export function toggleCourse(course: Omit<SavedCourse, 'at'>): void {
  store.set((shelf) => ({
    ...shelf,
    courses: shelf.courses.some((c) => c.code === course.code)
      ? shelf.courses.filter((c) => c.code !== course.code)
      : [{ ...course, at: Date.now() }, ...shelf.courses],
  }));
}

export function recordVisit(course: Omit<SavedCourse, 'at'>): void {
  store.set((shelf) => ({
    ...shelf,
    recent: [{ ...course, at: Date.now() }, ...shelf.recent.filter((c) => c.code !== course.code)].slice(0, RECENT_MAX),
  }));
}

export function clearRecent(): void {
  store.set((shelf) => ({ ...shelf, recent: [] }));
}
