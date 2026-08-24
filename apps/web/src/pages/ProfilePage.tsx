import { useMutation } from '@tanstack/react-query';
import { KeyRound, LoaderCircle, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { display, formatDate } from '../lib/labels';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const mutation = useMutation({ mutationFn: () => api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }), onSuccess: () => { toast('密码已修改，请重新登录'); window.setTimeout(() => void logout(), 1000); }, onError: (error) => toast(error instanceof Error ? error.message : '修改失败', 'error') });
  const submit = (event: FormEvent) => { event.preventDefault(); mutation.mutate(); };
  return <div className="mx-auto max-w-3xl space-y-5"><section><p className="text-sm font-medium text-brand">账号与安全</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">个人设置</h2></section><section className="surface p-5"><div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-xl font-bold text-brand">{user?.name.slice(0, 1)}</span><div><h3 className="text-lg font-semibold text-ink">{user?.name}</h3><p className="text-sm text-muted">{user?.role === 'ADMIN' ? '管理员' : '销售'}</p></div></div><dl className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2"><div><dt className="flex items-center gap-2 text-xs text-muted"><Smartphone className="h-4 w-4" />登录手机号</dt><dd className="mt-1 font-medium text-ink">{display(user?.mobile)}</dd></div><div><dt className="flex items-center gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4" />最后登录</dt><dd className="mt-1 font-medium text-ink">{formatDate(user?.lastLoginAt)}</dd></div></dl></section><section className="surface p-5"><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-brand" /><h3 className="font-semibold text-ink">修改密码</h3></div><form className="mt-5 space-y-4" onSubmit={submit}><label className="block"><span className="label">当前密码</span><input className="field" type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="block"><span className="label">新密码</span><input className="field" type="password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><span className="mt-1 block text-xs text-muted">至少8位，建议包含大小写字母、数字和符号。</span></label><button className="btn-primary" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}保存新密码</button></form></section><button className="btn-secondary w-full text-red-600" onClick={() => void logout()}><LogOut className="h-4 w-4" />退出当前账号</button></div>;
}
