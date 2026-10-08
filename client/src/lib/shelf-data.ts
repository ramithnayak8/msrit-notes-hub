import type { ShelfBranch } from '@/components/browse/Bookshelf';
import { apiGet, type BranchStat } from './api';
import { branchInfo } from './branches';

/** Branches with their counts, for the bookshelf (server components only). */
export async function getShelfBranches(): Promise<ShelfBranch[]> {
  const { items } = await apiGet<{ items: BranchStat[] }>('/branches');
  return items.map((b) => ({ ...branchInfo(b.code), ...b }));
}
