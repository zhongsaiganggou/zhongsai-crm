import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Filter, LoaderCircle, Plus, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LeadCard } from '../components/LeadCard';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { FollowUpModal } from '../components/FollowUpModal';
import { Modal } from '../components/Modal';
import { QualityBadge, SourceBadge, StatusBadge } from '../components/Badges';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api, queryString } from '../lib/api';
import { display, formatDate, projectTypeLabels, qualityLabels, sourceLabels } from '../lib/labels';
import type { Lead, LeadStatus, Paginated } from '../types';

const initialCreate = { name: '', countryCode: '', countryName: '', city: '', companyName: '', jobTitle: '', wechatId: '', whatsapp: '', phone: '', email: '', projectType: '', projectDescription: '', estimatedBudget: '', budgetCurrency: 'USD', remark: '' };

export function LeadsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', sourceType: '', statusId: '', qualityFlag: '', requiresReview: '' });
  const [searchDraft, setSearchDraft] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreate);
  const [followLead, setFollowLead] = useState<Lead | null>(null);
  const statuses = useQuery({ queryKey: ['lead-statuses'], queryFn: () => api<LeadStatus[]>('/leads/statuses') });
  const query = useMemo(() => queryString({ page, pageSize: 20, ...filters, requiresReview: filters.requiresReview || undefined }), [page, filters]);
  const leads = useQuery({ queryKey: ['leads', query], queryFn: () => api<Paginated<Lead>>(`/leads${query}`) });
  const create = useMutation({
    mutationFn: () => {
      const values = Object.fromEntries(Object.entries(createForm).filter(([, value]) => value !== ''));
      return api<Lead>('/leads', {
      method: 'POST', body: JSON.stringify({
        ...values,
        sourceType: 'MANUAL',
        countryCode: createForm.countryCode || undefined,
        projectType: createForm.projectType || undefined,
        estimatedBudget: createForm.estimatedBudget ? Number(createForm.estimatedBudget) : undefined,
      }),
    });
    },
    onSuccess: async () => { toast('客户已创建'); setCreateOpen(false); setCreateForm(initialCreate); await queryClient.invalidateQueries({ queryKey: ['leads'] }); await queryClient.invalidateQueries({ queryKey: ['overview'] }); },
    onError: (error) => toast(error instanceof Error ? error.message : '创建失败', 'error'),
  });

  const setFilter = (key: keyof typeof filters, value: string) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setFilter('search', searchDraft.trim()); };
  const submitCreate = (event: FormEvent) => { event.preventDefault(); create.mutate(); };

  return (
    <div className="space-y-5">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-brand">{user?.role === 'ADMIN' ? '全部广告及手动线索' : '仅显示分配给我的客户'}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">{user?.role === 'ADMIN' ? '客户线索' : '我的客户'}</h2></div>
        <button className="btn-primary self-start" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />手动添加客户</button>
      </section>

      <section className="surface p-4">
        <form className="flex gap-2" onSubmit={submitSearch}><label className="relative flex-1"><span className="sr-only">搜索客户</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="field pl-10" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="搜索姓名、公司、电话、微信或邮箱" /></label><button className="btn-primary px-4" type="submit">搜索</button></form>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label><span className="sr-only">客户来源</span><select className="field" value={filters.sourceType} onChange={(event) => setFilter('sourceType', event.target.value)}><option value="">全部来源</option>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="sr-only">客户状态</span><select className="field" value={filters.statusId} onChange={(event) => setFilter('statusId', event.target.value)}><option value="">全部状态</option>{statuses.data?.map((status) => <option key={status.id} value={status.id}>{status.nameZh}</option>)}</select></label>
          <label><span className="sr-only">线索质量</span><select className="field" value={filters.qualityFlag} onChange={(event) => setFilter('qualityFlag', event.target.value)}><option value="">全部质量</option>{Object.entries(qualityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {user?.role === 'ADMIN' && <label><span className="sr-only">核查状态</span><select className="field" value={filters.requiresReview} onChange={(event) => setFilter('requiresReview', event.target.value)}><option value="">全部核查状态</option><option value="true">需要核查</option><option value="false">无需核查</option></select></label>}
          <button className="btn-secondary" onClick={() => { setFilters({ search: '', sourceType: '', statusId: '', qualityFlag: '', requiresReview: '' }); setSearchDraft(''); setPage(1); }} type="button"><Filter className="h-4 w-4" />重置筛选</button>
        </div>
      </section>

      {leads.isLoading ? <Loading label="正在加载客户" /> : leads.error ? <ErrorState error={leads.error} retry={() => void leads.refetch()} /> : !leads.data?.items.length ? <EmptyState title="没有符合条件的客户" description="调整筛选条件，或手动添加一条客户线索。" action={<button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />添加客户</button>} /> : (
        <>
          <div className="grid gap-3 md:hidden">{leads.data.items.map((lead) => <LeadCard key={lead.id} lead={lead} onFollowUp={setFollowLead} />)}</div>
          <div className="surface hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-line bg-slate-50 text-xs font-semibold text-muted"><tr><th className="px-4 py-3">客户</th><th className="px-4 py-3">国家/地区</th><th className="px-4 py-3">来源</th><th className="px-4 py-3">质量</th><th className="px-4 py-3">状态</th>{user?.role === 'ADMIN' && <th className="px-4 py-3">销售</th>}<th className="px-4 py-3">最后跟进</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-line">{leads.data.items.map((lead) => <tr key={lead.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><Link className="font-semibold text-ink hover:text-brand" to={`/leads/${lead.id}`}>{display(lead.name)}</Link><p className="mt-1 max-w-48 truncate text-xs text-muted">{display(lead.companyName)} · {lead.leadNumber}</p></td><td className="px-4 py-4 text-slate-700">{display(lead.countryName)}<p className="text-xs text-muted">{display(lead.city)}</p></td><td className="px-4 py-4"><SourceBadge source={lead.sourceType} /></td><td className="px-4 py-4">{lead.qualityFlag === 'NORMAL' ? <span className="text-slate-500">正常</span> : <QualityBadge quality={lead.qualityFlag} />}</td><td className="px-4 py-4"><StatusBadge status={lead.currentStatus} /></td>{user?.role === 'ADMIN' && <td className="px-4 py-4">{display(lead.assignedUser?.name)}</td>}<td className="px-4 py-4 text-slate-600">{formatDate(lead.lastFollowedUpAt)}</td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><button className="btn-secondary px-3" onClick={() => setFollowLead(lead)}>添加跟进</button><Link className="btn-primary px-3" to={`/leads/${lead.id}`}>查看</Link></div></td></tr>)}</tbody></table>
          </div>
          <div className="flex items-center justify-between"><p className="text-sm text-muted">共 {leads.data.pagination.total} 条</p><div className="flex items-center gap-2"><button className="btn-secondary min-w-11 px-2" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="上一页"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 text-sm font-medium">第 {page} / {Math.max(leads.data.pagination.totalPages, 1)} 页</span><button className="btn-secondary min-w-11 px-2" disabled={page >= leads.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)} aria-label="下一页"><ChevronRight className="h-4 w-4" /></button></div></div>
        </>
      )}

      <Modal open={createOpen} title="手动添加客户" onClose={() => setCreateOpen(false)} footer={<><button className="btn-secondary" onClick={() => setCreateOpen(false)}>取消</button><button className="btn-primary" form="create-lead-form" disabled={create.isPending}>{create.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}保存客户</button></>}>
        <form id="create-lead-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submitCreate}>
          {([['name', '客户姓名'], ['countryName', '国家/地区'], ['city', '城市'], ['companyName', '公司名称'], ['jobTitle', '职位'], ['wechatId', '微信号'], ['whatsapp', 'WhatsApp'], ['phone', '电话号码'], ['email', '邮箱']] as const).map(([key, label]) => <label key={key} className="block"><span className="label">{label}</span><input className="field" type={key === 'email' ? 'email' : 'text'} value={createForm[key]} onChange={(event) => setCreateForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={`请输入${label}`} /></label>)}
          <label className="block"><span className="label">项目类型</span><select className="field" value={createForm.projectType} onChange={(event) => setCreateForm((current) => ({ ...current, projectType: event.target.value }))}><option value="">请选择</option>{Object.entries(projectTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block"><span className="label">预计预算</span><div className="flex"><input className="field rounded-r-none" type="number" min="0" value={createForm.estimatedBudget} onChange={(event) => setCreateForm((current) => ({ ...current, estimatedBudget: event.target.value }))} /><select className="field w-24 rounded-l-none border-l-0" value={createForm.budgetCurrency} onChange={(event) => setCreateForm((current) => ({ ...current, budgetCurrency: event.target.value }))}><option>USD</option><option>CNY</option><option>EUR</option></select></div></label>
          <label className="block sm:col-span-2"><span className="label">项目描述</span><textarea className="field min-h-24" value={createForm.projectDescription} onChange={(event) => setCreateForm((current) => ({ ...current, projectDescription: event.target.value }))} /></label>
          <label className="block sm:col-span-2"><span className="label">备注</span><textarea className="field min-h-20" value={createForm.remark} onChange={(event) => setCreateForm((current) => ({ ...current, remark: event.target.value }))} /></label>
        </form>
      </Modal>
      <FollowUpModal lead={followLead} onClose={() => setFollowLead(null)} />
    </div>
  );
}
