import type { Lead, LeadQualityFlag, LeadSource, LeadStatus } from '../types';
import { qualityLabels, sourceLabels } from '../lib/labels';

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: status.color, backgroundColor: `${status.color}14` }}>
      {status.nameZh}
    </span>
  );
}

const qualityStyles: Record<LeadQualityFlag, string> = {
  NORMAL: 'bg-emerald-50 text-emerald-700',
  NO_CONTACT: 'bg-amber-50 text-amber-700',
  INCOMPLETE_CONTACT: 'bg-amber-50 text-amber-700',
  SUSPECTED_SPAM: 'bg-red-50 text-red-700',
  POSSIBLE_DUPLICATE: 'bg-violet-50 text-violet-700',
  CONFIRMED_INVALID: 'bg-slate-100 text-slate-700',
};

export function QualityBadge({ quality }: { quality: LeadQualityFlag }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${qualityStyles[quality]}`}>{qualityLabels[quality]}</span>;
}

const sourceStyles: Record<LeadSource, string> = {
  META: 'bg-blue-50 text-blue-700',
  TIKTOK: 'bg-slate-900 text-white',
  MANUAL: 'bg-slate-100 text-slate-700',
};

export function SourceBadge({ source }: { source: LeadSource }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sourceStyles[source]}`}>{sourceLabels[source]}</span>;
}

export function LeadTags({ lead, limit }: { lead: Lead; limit?: number }) {
  const items = limit ? lead.tags.slice(0, limit) : lead.tags;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ tag }) => <span key={tag.id} className="rounded-full border px-2 py-0.5 text-xs font-medium" style={{ color: tag.color, borderColor: `${tag.color}55`, background: `${tag.color}0D` }}>{tag.name}</span>)}
      {limit && lead.tags.length > limit && <span className="text-xs text-muted">+{lead.tags.length - limit}</span>}
    </div>
  );
}

