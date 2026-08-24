import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarClock, Clipboard, FileText, LoaderCircle, Mail, MessageCircle, Phone,
  Plus, Tag as TagIcon, UserRoundCheck,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LeadTags, QualityBadge, SourceBadge, StatusBadge } from '../components/Badges';
import { ErrorState, Loading } from '../components/Feedback';
import { FollowUpModal } from '../components/FollowUpModal';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { copyText, whatsappUrl } from '../lib/clipboard';
import {
  communicationLabels, display, formatDate, invalidReasonLabels, projectTypeLabels,
  purchaseTimelineLabels, qualityLabels, sourceLabels,
} from '../lib/labels';
import type { Lead, LeadStatus, Tag, User } from '../types';

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return <div><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink">{display(value)}</dd></div>;
}

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [followOpen, setFollowOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#2563EB');
  const [reviewValid, setReviewValid] = useState(true);
  const [invalidReasonCode, setInvalidReasonCode] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const lead = useQuery({ queryKey: ['lead', id], queryFn: () => api<Lead>(`/leads/${id}`), enabled: Boolean(id) });
  const statuses = useQuery({ queryKey: ['lead-statuses'], queryFn: () => api<LeadStatus[]>('/leads/statuses') });
  const tags = useQuery({ queryKey: ['tags'], queryFn: () => api<Tag[]>('/tags') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/users'), enabled: user?.role === 'ADMIN' });

  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['lead', id] }); await queryClient.invalidateQueries({ queryKey: ['leads'] }); await queryClient.invalidateQueries({ queryKey: ['overview'] }); };
  const statusMutation = useMutation({ mutationFn: (statusId: string) => api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ statusId }) }), onSuccess: () => { toast('客户状态已更新'); void refresh(); }, onError: (error) => toast(error instanceof Error ? error.message : '修改失败', 'error') });
  const assignMutation = useMutation({ mutationFn: (userId: string) => api(`/leads/${id}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }), onSuccess: () => { toast('客户已分配'); void refresh(); }, onError: (error) => toast(error instanceof Error ? error.message : '分配失败', 'error') });
  const addTag = useMutation({ mutationFn: (tagId: string) => api(`/tags/${tagId}/leads/${id}`, { method: 'POST' }), onSuccess: () => { toast('标签已添加'); void refresh(); }, onError: (error) => toast(error instanceof Error ? error.message : '添加标签失败', 'error') });
  const removeTag = useMutation({ mutationFn: (tagId: string) => api(`/tags/${tagId}/leads/${id}`, { method: 'DELETE' }), onSuccess: () => { toast('标签已移除'); void refresh(); } });
  const createTag = useMutation({
    mutationFn: async () => {
      const tag = await api<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name: newTagName, color: newTagColor, scope: 'PERSONAL' }) });
      await api(`/tags/${tag.id}/leads/${id}`, { method: 'POST' });
    },
    onSuccess: async () => { toast('标签已创建并添加'); setNewTagName(''); await queryClient.invalidateQueries({ queryKey: ['tags'] }); await refresh(); },
    onError: (error) => toast(error instanceof Error ? error.message : '创建标签失败', 'error'),
  });
  const review = useMutation({
    mutationFn: () => api(`/leads/${id}/review`, { method: 'POST', body: JSON.stringify({ valid: reviewValid, invalidReasonCode: reviewValid ? undefined : invalidReasonCode, note: reviewNote || undefined }) }),
    onSuccess: async () => { toast(reviewValid ? '已确认为有效线索' : '已标记为无效线索'); setReviewOpen(false); await refresh(); },
    onError: (error) => toast(error instanceof Error ? error.message : '核查失败', 'error'),
  });

  const copy = async (value: string, label: string) => { await copyText(value); toast(`${label}已复制`); };
  const submitReview = (event: FormEvent) => { event.preventDefault(); review.mutate(); };

  if (lead.isLoading) return <Loading label="正在加载客户详情" />;
  if (lead.error || !lead.data) return <ErrorState error={lead.error ?? new Error('客户不存在')} retry={() => void lead.refetch()} />;
  const data = lead.data;
  const availableTags = tags.data?.filter((tag) => !data.tags.some((item) => item.tag.id === tag.id)) ?? [];
  const hasContact = Boolean(data.wechatId || data.whatsappRaw || data.phoneRaw || data.email);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3"><Link to="/leads" className="btn-secondary min-w-11 px-2" aria-label="返回客户列表"><ArrowLeft className="h-5 w-5" /></Link><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold tracking-tight text-ink">{display(data.name)}</h2><StatusBadge status={data.currentStatus} />{data.qualityFlag !== 'NORMAL' && <QualityBadge quality={data.qualityFlag} />}</div><p className="mt-1 text-sm text-muted">{data.leadNumber} · 创建于 {formatDate(data.createdAt)}</p></div></div>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setTagOpen(true)}><TagIcon className="h-4 w-4" />管理标签</button><button className="btn-primary" onClick={() => setFollowOpen(true)}><Plus className="h-4 w-4" />添加跟进</button></div>
      </div>

      <section className="surface p-5">
        <div className="flex flex-wrap items-center gap-2"><SourceBadge source={data.sourceType} /><LeadTags lead={data} />{data.requiresReview && <button className="min-h-11 rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800" onClick={() => setReviewOpen(true)}>待核查 · 立即处理</button>}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.wechatId && <button className="btn-secondary justify-start" onClick={() => void copy(data.wechatId!, '微信号')}><Clipboard className="h-4 w-4 text-emerald-600" />复制微信号</button>}
          {data.whatsappRaw && <a className="btn-secondary justify-start" href={whatsappUrl(data.whatsappNormalized ?? data.whatsappRaw)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 text-emerald-600" />打开 WhatsApp</a>}
          {data.phoneRaw && <><button className="btn-secondary justify-start" onClick={() => void copy(data.phoneNormalized ?? data.phoneRaw!, '电话号码')}><Clipboard className="h-4 w-4 text-brand" />复制电话号码</button><a className="btn-secondary justify-start" href={`tel:${data.phoneNormalized ?? data.phoneRaw}`}><Phone className="h-4 w-4 text-brand" />拨打电话</a></>}
          {data.email && <a className="btn-secondary justify-start" href={`mailto:${data.email}`}><Mail className="h-4 w-4 text-brand" />发送邮件</a>}
        </div>
        {!hasContact && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4"><p className="font-semibold text-amber-900">该客户没有任何联系方式</p><p className="mt-1 text-sm text-amber-800">请查看广告表单和项目信息，再确认是否为有效线索。</p></div>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <div className="space-y-5">
          <section className="surface p-5"><h3 className="font-semibold text-ink">客户资料</h3><dl className="mt-5 grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><DetailItem label="客户ID" value={data.id} /><DetailItem label="客户姓名" value={data.name} /><DetailItem label="国家/地区" value={data.countryName} /><DetailItem label="城市" value={data.city} /><DetailItem label="公司名称" value={data.companyName} /><DetailItem label="职位" value={data.jobTitle} /><DetailItem label="微信号" value={data.wechatId} /><DetailItem label="WhatsApp" value={data.whatsappRaw} /><DetailItem label="电话号码" value={data.phoneRaw} /><DetailItem label="邮箱" value={data.email} /></dl></section>
          <section className="surface p-5"><h3 className="font-semibold text-ink">项目信息</h3><dl className="mt-5 grid gap-x-5 gap-y-5 sm:grid-cols-2"><DetailItem label="项目类型" value={data.projectType ? projectTypeLabels[data.projectType] : null} /><DetailItem label="采购时间" value={data.purchaseTimeline ? purchaseTimelineLabels[data.purchaseTimeline] : null} /><DetailItem label="预计采购日期" value={data.expectedPurchaseDate ? formatDate(data.expectedPurchaseDate, false) : null} /><DetailItem label="预计预算" value={data.estimatedBudget ? `${data.budgetCurrency ?? ''} ${data.estimatedBudget}` : null} /><div className="sm:col-span-2"><DetailItem label="项目描述" value={data.projectDescription} /></div><div className="sm:col-span-2"><DetailItem label="备注" value={data.remark} /></div></dl></section>
          <section className="surface p-5"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-brand" /><h3 className="font-semibold text-ink">广告来源</h3></div>{data.attributions.length ? <div className="mt-4 space-y-3">{data.attributions.map((item) => <dl key={item.id} className="grid gap-4 rounded-lg border border-line bg-slate-50 p-4 sm:grid-cols-2"><DetailItem label="来源平台" value={sourceLabels[item.platform]} /><DetailItem label="Lead ID" value={item.externalLeadId} /><DetailItem label="Campaign名称" value={item.campaignName} /><DetailItem label="Ad Set名称" value={item.adsetName} /><DetailItem label="广告名称/素材" value={item.adName} /><DetailItem label="Form名称" value={item.formName} /><DetailItem label="广告线索创建时间" value={formatDate(item.externalCreatedAt)} /><DetailItem label="CRM接收时间" value={formatDate(item.receivedAt)} /></dl>)}</div> : <p className="mt-4 text-sm text-muted">暂无广告归因记录</p>}</section>
        </div>

        <div className="space-y-5">
          <section className="surface p-5"><h3 className="font-semibold text-ink">负责人和状态</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><label><span className="label">客户状态</span><select className="field" value={data.currentStatusId} disabled={statusMutation.isPending} onChange={(event) => statusMutation.mutate(event.target.value)}>{statuses.data?.map((status) => <option key={status.id} value={status.id} disabled={status.code === 'INVALID' && status.id !== data.currentStatusId}>{status.nameZh}</option>)}</select></label>{user?.role === 'ADMIN' ? <label><span className="label">负责销售</span><select className="field" value={data.assignedUserId ?? ''} disabled={assignMutation.isPending} onChange={(event) => event.target.value && assignMutation.mutate(event.target.value)}><option value="">待分配</option>{users.data?.filter((item) => item.role === 'SALES' && item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <DetailItem label="负责销售" value={data.assignedUser?.name} />}</div>{!data.requiresReview && data.qualityFlag !== 'CONFIRMED_INVALID' && <button className="btn-secondary mt-4 w-full" onClick={() => setReviewOpen(true)}><UserRoundCheck className="h-4 w-4" />核查线索质量</button>}</section>
          <section className="surface p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-ink">跟进记录</h3><p className="mt-1 text-sm text-muted">按跟进时间倒序</p></div><button className="btn-secondary px-3" onClick={() => setFollowOpen(true)}><Plus className="h-4 w-4" />添加</button></div>{data.followUps?.length ? <ol className="mt-5 space-y-0">{data.followUps.map((item, index) => <li key={item.id} className="relative flex gap-3 pb-5"><span className="relative z-10 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-brand"><CalendarClock className="h-4 w-4" /></span>{index < data.followUps!.length - 1 && <span className="absolute bottom-0 left-4 top-8 w-px bg-line" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">{communicationLabels[item.communicationMethod]} · {item.user.name}</p><time className="text-xs text-muted">{formatDate(item.followedUpAt)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</p>{item.nextFollowUpAt && <p className="mt-2 text-xs font-medium text-orange-700">下次跟进：{formatDate(item.nextFollowUpAt)}</p>}</div></li>)}</ol> : <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-muted">暂无跟进记录</p>}</section>
        </div>
      </div>

      <FollowUpModal lead={followOpen ? data : null} onClose={() => setFollowOpen(false)} />
      <Modal open={tagOpen} title="管理客户标签" onClose={() => setTagOpen(false)}>
        <div><p className="label">已添加标签</p><div className="flex min-h-11 flex-wrap gap-2">{data.tags.length ? data.tags.map(({ tag }) => <button key={tag.id} className="min-h-11 rounded-full border px-3 text-xs font-semibold" style={{ color: tag.color, borderColor: `${tag.color}66` }} onClick={() => removeTag.mutate(tag.id)} title="点击移除">{tag.name} ×</button>) : <span className="text-sm text-muted">尚未添加标签</span>}</div></div>
        {availableTags.length > 0 && <div className="mt-5"><p className="label">可用标签</p><div className="flex flex-wrap gap-2">{availableTags.map((tag) => <button key={tag.id} className="btn-secondary px-3" onClick={() => addTag.mutate(tag.id)}><Plus className="h-3.5 w-3.5" />{tag.name}</button>)}</div></div>}
        <form className="mt-6 border-t border-line pt-5" onSubmit={(event) => { event.preventDefault(); createTag.mutate(); }}><p className="label">创建个人标签</p><div className="flex gap-2"><input className="field flex-1" required maxLength={50} value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="例如：重点客户" /><input className="h-11 w-14 rounded-md border border-line p-1" type="color" aria-label="标签颜色" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} /><button className="btn-primary" disabled={createTag.isPending}>创建</button></div></form>
      </Modal>
      <Modal open={reviewOpen} title="核查线索质量" onClose={() => setReviewOpen(false)} footer={<><button className="btn-secondary" onClick={() => setReviewOpen(false)}>取消</button><button className="btn-primary" form="review-form" disabled={review.isPending}>{review.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}确认核查</button></>}>
        <form id="review-form" className="space-y-4" onSubmit={submitReview}><fieldset><legend className="label">核查结果</legend><div className="grid grid-cols-2 gap-2"><label className={`flex min-h-12 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold ${reviewValid ? 'border-brand bg-blue-50 text-brand' : 'border-line'}`}><input className="sr-only" type="radio" checked={reviewValid} onChange={() => setReviewValid(true)} />有效线索</label><label className={`flex min-h-12 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold ${!reviewValid ? 'border-red-400 bg-red-50 text-red-700' : 'border-line'}`}><input className="sr-only" type="radio" checked={!reviewValid} onChange={() => setReviewValid(false)} />无效线索</label></div></fieldset>{!reviewValid && <label className="block"><span className="label">无效原因</span><select className="field" required value={invalidReasonCode} onChange={(event) => setInvalidReasonCode(event.target.value)}><option value="">请选择原因</option>{Object.entries(invalidReasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<label className="block"><span className="label">核查说明</span><textarea className="field min-h-24" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="说明判断依据，便于后续追踪" /></label><p className="rounded-md bg-slate-50 px-3 py-3 text-xs leading-5 text-muted">当前质量：{qualityLabels[data.qualityFlag]}。无效线索仍会保留广告来源，不会被删除。</p></form>
      </Modal>
    </div>
  );
}
