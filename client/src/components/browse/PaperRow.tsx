import { Icon, type IconName } from '@/components/ui/Icon';
import type { ExternalPaper } from '@/lib/types';

const KIND: Record<ExternalPaper['kind'], { icon: IconName; label: string }> = {
  pdf: { icon: 'file', label: 'PDF' },
  image: { icon: 'image', label: 'Photo' },
  doc: { icon: 'file', label: 'Document' },
  file: { icon: 'file', label: 'Drive file' },
};

/** One past paper hosted elsewhere. Opens the original file on Google Drive in a new tab. */
export function PaperRow({ paper }: { paper: ExternalPaper }) {
  const kind = KIND[paper.kind];
  const when = [paper.month, paper.year].filter(Boolean).join(' ');
  const branches = (paper.branch ?? '').split(', ').filter(Boolean);
  const branchText = branches.length > 2 ? `${branches.slice(0, 2).join(', ')} +${branches.length - 2}` : branches.join(', ');
  return (
    <li className="paper-row">
      <a href={paper.url} target="_blank" rel="noopener noreferrer" className="paper-link">
        <span className="paper-exam" data-exam={paper.exam_type.split(' ')[0].toLowerCase()}>{paper.exam_type}</span>
        <span className="paper-main">
          <span className="paper-title">{paper.title}</span>
          <span className="paper-meta">
            <span className="paper-kind"><Icon name={kind.icon} size={13} /> {kind.label}</span>
            {when && <span>· {when}</span>}
            {branchText && <span title={paper.branch ?? undefined}>· {branchText}</span>}
          </span>
        </span>
        <span className="paper-open" aria-hidden>
          <Icon name="external" size={16} />
        </span>
        <span className="visually-hidden">(opens Google Drive in a new tab)</span>
      </a>
    </li>
  );
}
