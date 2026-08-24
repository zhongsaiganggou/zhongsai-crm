import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ClipboardCheck, Clock3, Plus, UserPlus, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { LeadCard } from '../components/LeadCard';
import { MetricCard } from '../components/MetricCard';
import { useAuth } from '../contexts/AuthContext';
import { api, queryString } from '../lib/api';
import { sourceLabels } from '../lib/labels';
import type { Lead, Overview, Paginated } from '../types';

function Bars({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="space-y-4">{items.map((item) => <div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-slate-700">{item.label}</span><span className="font-semibold text-ink">{item.value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${(item.value / max) * 100}%` }} /></div></div>)}</div>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/analytics/overview') });
  const queue = useQuery({
    queryKey: ['dashboard-leads', user?.role],
    queryFn: () => api<Paginated<Lead>>(`/leads${queryString({ page: 1, pageSize: user?.role === 'SALES' ? 8 : 5 })}`),
  });

  if (overview.isLoading || queue.isLoading) return <Loading label="正在整理今日线索" />;
  if (overview.error) return <ErrorState error={overview.error} retry={() => void overview.refetch()} />;
  const data = overview.data!;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-brand">{user?.role === 'ADMIN' ? '广告线索运营' : '今日跟进工作台'}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">欢迎回来，{user?.name}</h2><p className="mt-1 text-sm text-muted">优先处理待跟进、长期未跟进和待核查客户。</p></div>
        <Link className="btn-primary self-start" to="/leads"><Plus className="h-4 w-4" />{user?.role === 'ADMIN' ? '添加客户' : '查看我的客户'}</Link>
      </section>

      <section className={`grid grid-cols-2 gap-3 lg:gap-4 ${user?.role === 'ADMIN' ? 'xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {user?.role === 'ADMIN' && <MetricCard title="总客户数量" value={data.total} icon={UsersRound} />}
        <MetricCard title="今日新增" value={data.today} icon={UserPlus} />
        <MetricCard title="待跟进" value={data.due} icon={CalendarClock} tone="orange" />
        <MetricCard title="超过3天未跟进" value={data.overdueThreeDays} icon={Clock3} tone="red" />
        <MetricCard title={user?.role === 'ADMIN' ? '有效客户' : '我的客户'} value={user?.role === 'ADMIN' ? data.valid : data.total} icon={ClipboardCheck} tone="violet" />
      </section>

      {user?.role === 'ADMIN' && (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="surface p-5"><div className="mb-5"><h3 className="font-semibold text-ink">按来源统计</h3><p className="mt-1 text-sm text-muted">仅展示 CRM 已接收的真实线索</p></div><Bars items={data.bySource.map((item) => ({ label: sourceLabels[item.sourceType], value: item._count }))} /></article>
          <article className="surface p-5"><div className="mb-5"><h3 className="font-semibold text-ink">按状态统计</h3><p className="mt-1 text-sm text-muted">客户当前所处跟进阶段</p></div><Bars items={data.byStatus.map((item) => ({ label: item.nameZh, value: item.count }))} /></article>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-lg font-semibold text-ink">{user?.role === 'SALES' ? '我的跟进队列' : '最新线索'}</h3><p className="mt-0.5 text-sm text-muted">按线索进入时间排序</p></div><Link to="/leads" className="text-sm font-semibold text-brand hover:text-blue-700">查看全部</Link></div>
        {queue.error ? <ErrorState error={queue.error} retry={() => void queue.refetch()} /> : queue.data?.items.length ? <div className="grid gap-3 xl:grid-cols-2">{queue.data.items.map((lead) => <LeadCard key={lead.id} lead={lead} />)}</div> : <EmptyState title="暂时没有客户线索" description="新进入或分配给您的客户会显示在这里。" />}
      </section>
    </div>
  );
}
