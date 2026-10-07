'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { logActivity } from '@/lib/client/activity';
import { recordVisit, toggleCourse, toggleQuestion, useShelf, type SavedCourse, type SavedQuestion } from '@/lib/client/shelf';

/** Bookmark toggle for one question. */
export function BookmarkButton({ question }: { question: Omit<SavedQuestion, 'savedAt'> }) {
  const { questions } = useShelf();
  const saved = questions.some((q) => q.id === question.id);
  return (
    <button
      type="button"
      className={`bookmark-btn${saved ? ' is-saved' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove Q${question.number} from your shelf` : `Save Q${question.number} to your shelf`}
      title={saved ? 'Saved to your shelf' : 'Save to your shelf'}
      onClick={() => toggleQuestion(question)}
    >
      <Icon name="bookmark" size={16} filled={saved} />
    </button>
  );
}

type CourseRef = Omit<SavedCourse, 'at'>;

export function SaveCourseButton({ course }: { course: CourseRef }) {
  const { courses } = useShelf();
  const saved = courses.some((c) => c.code === course.code);
  return (
    <button
      type="button"
      className={`btn btn-outline btn-sm${saved ? ' is-saved' : ''}`}
      aria-pressed={saved}
      onClick={() => toggleCourse(course)}
    >
      <Icon name="bookmark" size={16} filled={saved} /> {saved ? 'On your shelf' : 'Save course'}
    </button>
  );
}

/** Records a course visit for "recently viewed" and the study streak. Renders nothing. */
export function RecordVisit({ course }: { course: CourseRef }) {
  const { code, title, dept, semester } = course;
  useEffect(() => {
    recordVisit({ code, title, dept, semester });
    logActivity('visit');
  }, [code, title, dept, semester]);
  return null;
}
