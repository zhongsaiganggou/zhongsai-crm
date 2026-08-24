import { Clipboard, Mail, MessageCircle, Phone, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { copyText, whatsappUrl } from '../lib/clipboard';
import { display, formatDate } from '../lib/labels';
import type { Lead } from '../types';
import { LeadTags, QualityBadge, SourceBadge, StatusBadge } from './Badges';

export function LeadCard({ lead, onFollowUp }: { lead: Lead; onFollowUp?: (lead: Lead) => void }) {
  const toast = useToast();
  const copy = async (value: string, label: string) => {
    await copyText(value);
    toast(`${label}已复制`);
  };
  const location = [lead.countryName, lead.city].filter(Boolean).join(' · ') || '国家/地区未提供';
  const hasContact = Boolean(lead.wechatId || lead.whatsappRaw || lead.phoneRaw || lead.email);

  return (
    <article className="surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/leads/${lead.id}`} className="block min-h-0 truncate text-base font-semibold text-ink hover:text-brand">{display(lead.name)}</Link>
          <p className="mt-1 truncate text-sm text-muted">{location}{lead.companyName ? ` · ${lead.companyName}` : ''}</p>
        </div>
        <StatusBadge status={lead.currentStatus} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SourceBadge source={lead.sourceType} />
        {lead.qualityFlag !== 'NORMAL' && <QualityBadge quality={lead.qualityFlag} />}
        <LeadTags lead={lead} limit={2} />
      </div>

      {hasContact ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {lead.wechatId && <button className="btn-secondary px-2" onClick={() => void copy(lead.wechatId!, '微信号')}><Clipboard className="h-4 w-4 text-emerald-600" />复制微信</button>}
          {lead.whatsappRaw && <a className="btn-secondary px-2" href={whatsappUrl(lead.whatsappNormalized ?? lead.whatsappRaw)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 text-emerald-600" />WhatsApp</a>}
          {lead.phoneRaw && <><button className="btn-secondary px-2" onClick={() => void copy(lead.phoneNormalized ?? lead.phoneRaw!, '电话号码')}><Clipboard className="h-4 w-4 text-brand" />复制号码</button><a className="btn-secondary px-2" href={`tel:${lead.phoneNormalized ?? lead.phoneRaw}`}><Phone className="h-4 w-4 text-brand" />拨打电话</a></>}
          {lead.email && <a className="btn-secondary px-2" href={`mailto:${lead.email}`}><Mail className="h-4 w-4 text-brand" />发邮件</a>}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">该客户未提供任何联系方式，请核查原始表单。</div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="text-xs text-muted">
          <span>最后跟进：{formatDate(lead.lastFollowedUpAt)}</span>
          {lead.nextFollowUpAt && <span className="ml-3">下次：{formatDate(lead.nextFollowUpAt)}</span>}
        </div>
        {onFollowUp ? <button className="btn-primary shrink-0 px-3" onClick={() => onFollowUp(lead)}><Plus className="h-4 w-4" />添加跟进</button> : <Link className="btn-secondary shrink-0 px-3" to={`/leads/${lead.id}`}>查看详情</Link>}
      </div>
    </article>
  );
}
