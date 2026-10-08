/** How each branch is shown: names and spine colours. Counts come from the API. */
export type BranchInfo = { code: string; name: string; fullName: string; from: string; to: string };

export const BRANCHES: BranchInfo[] = [
  { code: 'CSE', name: 'Computer Science', fullName: 'Computer Science & Engineering', from: 'oklch(68% 0.19 296)', to: 'oklch(66% 0.18 258)' },
  { code: 'AIML', name: 'AI & Machine Learning', fullName: 'CSE (Artificial Intelligence & Machine Learning)', from: 'oklch(68% 0.19 296)', to: 'oklch(78% 0.13 200)' },
  { code: 'ISE', name: 'Information Science', fullName: 'Information Science & Engineering', from: 'oklch(66% 0.18 258)', to: 'oklch(78% 0.13 200)' },
  { code: 'CY', name: 'Cyber Security', fullName: 'CSE (Cyber Security)', from: 'oklch(70% 0.15 340)', to: 'oklch(68% 0.19 296)' },
  { code: 'AIDS', name: 'AI & Data Science', fullName: 'Artificial Intelligence & Data Science', from: 'oklch(74% 0.13 165)', to: 'oklch(68% 0.19 296)' },
  { code: 'ECE', name: 'Electronics', fullName: 'Electronics & Communication Engineering', from: 'oklch(78% 0.13 200)', to: 'oklch(68% 0.19 296)' },
  { code: 'EIE', name: 'Instrumentation', fullName: 'Electronics & Instrumentation Engineering', from: 'oklch(76% 0.15 130)', to: 'oklch(78% 0.13 200)' },
  { code: 'ETE', name: 'Telecommunication', fullName: 'Electronics & Telecommunication Engineering', from: 'oklch(78% 0.13 200)', to: 'oklch(74% 0.13 165)' },
  { code: 'EEE', name: 'Electrical', fullName: 'Electrical & Electronics Engineering', from: 'oklch(70% 0.16 40)', to: 'oklch(75% 0.14 80)' },
  { code: 'ME', name: 'Mechanical', fullName: 'Mechanical Engineering', from: 'oklch(72% 0.16 25)', to: 'oklch(70% 0.15 340)' },
  { code: 'CV', name: 'Civil', fullName: 'Civil Engineering', from: 'oklch(74% 0.13 165)', to: 'oklch(78% 0.13 200)' },
  { code: 'CH', name: 'Chemical', fullName: 'Chemical Engineering', from: 'oklch(75% 0.14 80)', to: 'oklch(72% 0.16 25)' },
  { code: 'BT', name: 'Biotechnology', fullName: 'Biotechnology', from: 'oklch(74% 0.13 165)', to: 'oklch(76% 0.15 130)' },
  { code: 'COMMON', name: 'Common courses', fullName: 'Courses common to all branches', from: 'oklch(75% 0.14 80)', to: 'oklch(70% 0.16 40)' },
];

export const branchInfo = (code: string): BranchInfo =>
  BRANCHES.find((b) => b.code === code) ?? { code, name: code, fullName: code, from: 'oklch(68% 0.19 296)', to: 'oklch(66% 0.18 258)' };
