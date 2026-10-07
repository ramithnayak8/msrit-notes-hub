/** Student-run archives whose past papers the library links to. */
export const PAPER_SOURCES: Record<string, { name: string; url: string; about: string; contribute: string }> = {
  ritnotebook: {
    name: 'RIT Notebook',
    url: 'https://ritnotebook.netlify.app',
    about: 'Notes, PYQs and lab code for every branch and year, collected by MSRIT students.',
    contribute: 'https://ritnotebook.netlify.app',
  },
  riserit: {
    name: 'RIT ISE',
    url: 'https://riserit.vercel.app/resources',
    about: 'The crowdsourced resource portal of the ISE department, by Mohit Nair and contributors.',
    contribute: 'mailto:riserit@proton.me',
  },
};

/** Exam filters shown in the library, each covering one or more stored exam types. */
export const EXAM_GROUPS = [
  { id: 'cie', label: 'CIE', match: ['CIE', 'CIE 1', 'CIE 2', 'CIE 3', 'Quiz'] },
  { id: 'see', label: 'SEE', match: ['SEE'] },
  { id: 'makeup', label: 'Makeup', match: ['Makeup'] },
  { id: 'backlog', label: 'Backlog', match: ['Backlog'] },
  { id: 'qb', label: 'Question banks', match: ['Question bank'] },
  { id: 'other', label: 'Other papers', match: ['Paper', 'Model paper', 'VTU paper'] },
] as const;
