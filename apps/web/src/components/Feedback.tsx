import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function Loading({ label = '正在加载' }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle className="h-5 w-5 animate-spin" />{label}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="surface flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500"><Inbox className="h-6 w-6" /></span>
      <h3 className="font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : '加载失败，请稍后重试';
  return (
    <div className="surface flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 rounded-full bg-red-50 p-3 text-red-600"><CircleAlert className="h-6 w-6" /></span>
      <h3 className="font-semibold text-ink">无法加载数据</h3>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {retry && <button className="btn-secondary mt-4" onClick={retry}>重新加载</button>}
    </div>
  );
}

