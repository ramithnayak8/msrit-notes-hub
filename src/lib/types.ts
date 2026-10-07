export type Department = {
  code: string;
  name: string;
  full_name: string;
  status: 'active' | 'growing' | 'planned';
  accent_from: string;
  accent_to: string;
};

export type DepartmentWithStats = Department & {
  course_count: number;
  /** Past papers linked from other student archives. */
  library_count: number;
  paper_count: number;
  question_count: number;
  note_count: number;
};

export type Course = {
  code: string;
  title: string;
  dept_code: string;
  semester: number;
  credits: number;
};

export type CourseWithStats = Course & {
  paper_count: number;
  question_count: number;
  note_count: number;
};

export type Paper = {
  id: number;
  course_code: string;
  exam_type: string;
  year: number;
  month: string;
  label: string;
  question_count?: number;
};

export type Question = {
  id: number;
  paper_id: number;
  course_code: string;
  number: string;
  text: string;
  marks: number;
  unit: number;
  topics: string;
  level: string;
};

export type QuestionHit = {
  id: number;
  courseCode: string;
  courseTitle: string;
  deptCode: string;
  number: string;
  text: string;
  marks: number;
  unit: number;
  topics: string[];
  level: string;
  examType: string;
  year: number;
  month: string;
  paperLabel: string;
  score: number;
  matchedTerms: string[];
};

export type Note = {
  id: number;
  course_code: string;
  title: string;
  kind: string;
  pages: number;
  contributor: string;
  year: number;
};

export type SyllabusVersion = {
  id: number;
  course_code: string;
  academic_year: string;
  effective_from: string;
};

export type SyllabusUnit = {
  unit: number;
  unitTitle: string;
  hours: number;
  topics: string[];
};

export type SyllabusDiff = {
  courseCode: string;
  courseTitle: string;
  from: SyllabusVersion;
  to: SyllabusVersion;
  added: { unit: number; unitTitle: string; topic: string }[];
  removed: { unit: number; unitTitle: string; topic: string }[];
  unchangedCount: number;
  newUnits: { unit: number; unitTitle: string; hours: number }[];
};

export type ParsedQuery = {
  raw: string;
  terms: string[];
  expandedTerms: { term: string; weight: number }[];
  intent: 'questions' | 'syllabus-change' | 'notes';
  filters: {
    yearFrom?: number;
    yearTo?: number;
    deptCode?: string;
    courseCode?: string;
    /** Courses matched by name or abbreviation, e.g. "Operating Systems" -> CS501. */
    courseCodes?: string[];
    minMarks?: number;
  };
  explanation: string[];
};

export type SearchResponse = {
  query: ParsedQuery;
  hits: QuestionHit[];
  total: number;
  tookMs: number;
  topicSummary: { topic: string; count: number }[];
  yearSummary: { year: number; count: number }[];
};

/** A past paper hosted by another student site; we store the link, not the file. */
export type ExternalPaper = {
  id: number;
  source: string;
  branch: string | null;
  dept_code: string | null;
  semester: number | null;
  study_year: number | null;
  subject: string;
  course_code: string | null;
  exam_type: string;
  year: number | null;
  month: string | null;
  title: string;
  kind: 'pdf' | 'image' | 'doc' | 'file';
  url: string;
};
