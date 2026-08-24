import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, LoaderCircle, ShieldAlert, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { QualityBadge, SourceBadge } from '../components/Badges';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { useToast } from '../contexts/ToastContext';
import { api, queryString } from '../lib/api';
import { display, formatDate, invalidReasonLabels } from '../lib/labels';
import type { Lead, Paginated } from '../types';

export function ReviewPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Lead | null>(null);
  const [valid, setValid] = useState(true);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const leads = useQuery({ queryKey: ['leads', 'review'], queryFn: () => api<Paginated<Lead>>(`/leads${queryString({ requiresReview: true, pageSize: 100 })}`) });
  const review = useMutation({
    mutationFn: () => api(`/leads/${selected!.id}/review`, { method: 'POST', body: JSON.stringify({ valid, invalidReasonCode: valid ? undefined : reason, note: note || undefined }) }),
    onSuccess: async () => { toast(valid ? '已确认有效' : '已确认无效'); setSelected(null); setReason(''); setNote(''); await queryClient.invalidateQueries({ queryKey: ['leads'] }); await queryClient.invalidateQueries({ queryKey: ['overview'] }); },
    onError: (error) => toast(error instanceof Error ? error.message : '核查失败', 'error'),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); review.mutate(); };

  if (leads.isLoading) return <Loading label="正在加载待核查线索" />;
  if (leads.error) return <ErrorState error={leads.error} retry={() => void leads.refetch()} />;

  return (
    <div className="space-y-5">
      <section><p className="text-sm font-medium text-brand">线索质量控制</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">待核查线索</h2><p className="mt-1 text-sm text-muted">无联系方式、信息不完整、疑似垃圾或重复的表单会进入这里。</p></section>
      {!leads.data?.items.length ? <EmptyState title="没有待核查线索" description="当前所有广告表单均已完成质量核查。" /> : <div className="grid gap-3 lg:grid-cols-2">{leads.data.items.map((lead) => <article className="surface p-5" key={lead.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{display(lead.name)}</h3><p className="mt-1 text-sm text-muted">{display(lead.countryName)} · {lead.leadNumber}</p></div><QualityBadge quality={lead.qualityFlag} /></div><div className="mt-3 flex items-center gap-2"><SourceBadge source={lead.sourceType} /><span className="text-xs text-muted">{formatDate(lead.createdAt)}</span></div><div className="mt-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">{lead.contactAvailability === 'NONE' ? '未提供任何联系方式' : `电话：${display(lead.phoneRaw)}　WhatsApp：${display(lead.whatsappRaw)}　微信：${display(lead.wechatId)}`}</div><div className="mt-4 flex gap-2"><button className="btn-primary flex-1" onClick={() => { setValid(true); setSelected(lead); }}><Check className="h-4 w-4" />核查</button><Link className="btn-secondary" to={`/leads/${lead.id}`}><ExternalLink className="h-4 w-4" />详情</Link></div></article>)}</div>}
      <Modal open={Boolean(selected)} title={`核查 · ${selected?.name || '姓名未提供'}`} onClose={() => setSelected(null)} footer={<><button className="btn-secondary" onClick={() => setSelected(null)}>取消</button><button className="btn-primary" form="review-page-form" disabled={review.isPending}>{review.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}保存结果</button></>}>
        <form id="review-page-form" className="space-y-4" onSubmit={submit}><div className="grid grid-cols-2 gap-2"><button type="button" className={`btn-secondary ${valid ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : ''}`} onClick={() => setValid(true)}><Check className="h-4 w-4" />有效线索</button><button type="button" className={`btn-secondary ${!valid ? 'border-red-400 bg-red-50 text-red-700' : ''}`} onClick={() => setValid(false)}><X className="h-4 w-4" />无效线索</button></div>{!valid && <label className="block"><span className="label">无效原因</span><select className="field" required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">请选择原因</option>{Object.entries(invalidReasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<label className="block"><span className="label">核查说明</span><textarea className="field min-h-28" value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录核查依据" /></label><div className="flex gap-2 rounded-md bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />确认无效后仍会保留原始表单和广告归因数据。</div></form>
      </Modal>
    </div>
  );
}

