import { useQuery } from '@tanstack/react-query';
import { FileInput, Globe2, Image as ImageIcon, Megaphone } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { api } from '../lib/api';
import { display, sourceLabels } from '../lib/labels';
import type { AdsAnalytics } from '../types';

function Ranking({ title, subtitle, icon: Icon, items }: { title: string; subtitle: string; icon: typeof Megaphone; items: Array<{ id: string; name: string; platform?: string; count: number }> }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return <article className="surface p-5"><div className="flex items-start gap-3"><span className="rounded-lg bg-blue-50 p-2.5 text-brand"><Icon className="h-5 w-5" /></span><div><h3 className="font-semibold text-ink">{title}</h3><p className="mt-1 text-sm text-muted">{subtitle}</p></div></div>{items.length ? <div className="mt-6 space-y-4">{items.slice(0, 12).map((item) => <div key={item.id}><div className="mb-1.5 flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{item.name}</p>{item.platform && <p className="text-xs text-muted">{item.platform}</p>}</div><span className="text-sm font-bold text-ink">{item.count}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${(item.count / max) * 100}%` }} /></div></div>)}</div> : <p className="mt-6 text-sm text-muted">暂无数据</p>}</article>;
}

export function AdsPage() {
  const query = useQuery({ queryKey: ['ads-analytics'], queryFn: () => api<AdsAnalytics>('/analytics/ads') });
  if (query.isLoading) return <Loading label="正在汇总广告归因" />;
  if (query.error || !query.data) return <ErrorState error={query.error ?? new Error('暂无数据')} retry={() => void query.refetch()} />;
  const data = query.data;
  const campaigns = data.campaigns.map((item, index) => ({ id: item.campaignId ?? `campaign-${index}`, name: display(item.campaignName), platform: sourceLabels[item.platform], count: item._count }));
  const ads = data.ads.map((item, index) => ({ id: item.adId ?? `ad-${index}`, name: display(item.adName), platform: sourceLabels[item.platform], count: item._count }));
  const forms = data.forms.map((item, index) => ({ id: item.formId ?? `form-${index}`, name: display(item.formName), platform: sourceLabels[item.platform], count: item._count }));
  const countries = data.countries.map((item, index) => ({ id: item.countryCode ?? `country-${index}`, name: display(item.countryName ?? item.countryCode), count: item._count }));

  return <div className="space-y-5"><section><p className="text-sm font-medium text-brand">广告归因分析</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">广告数据</h2><p className="mt-1 text-sm text-muted">统计 CRM 已接收的线索数量，不包含广告花费、CPL 或 ROI。</p></section>{!campaigns.length && !ads.length && !forms.length ? <EmptyState title="暂无广告归因数据" description="Meta Webhook 接收到广告线索后，这里会按 Campaign、广告和表单汇总。" /> : <section className="grid gap-4 xl:grid-cols-2"><Ranking title="Campaign线索量" subtitle="按 Campaign 名称汇总" icon={Megaphone} items={campaigns} /><Ranking title="广告/素材线索量" subtitle="按广告名称汇总" icon={ImageIcon} items={ads} /><Ranking title="表单线索量" subtitle="按 Instant Form 汇总" icon={FileInput} items={forms} /><Ranking title="国家/地区分布" subtitle="按客户填写的国家汇总" icon={Globe2} items={countries} /></section>}</div>;
}
