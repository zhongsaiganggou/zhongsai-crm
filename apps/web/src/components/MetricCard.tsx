import type { LucideIcon } from 'lucide-react';

export function MetricCard({ title, value, icon: Icon, tone = 'blue' }: { title: string; value: number; icon: LucideIcon; tone?: 'blue' | 'orange' | 'red' | 'violet' }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone];
  return (
    <article className="surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-ink">{value.toLocaleString('zh-CN')}</p>
        </div>
        <span className={`rounded-lg p-2.5 ${styles}`}><Icon className="h-5 w-5" /></span>
      </div>
    </article>
  );
}

