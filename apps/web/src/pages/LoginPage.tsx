import { Building2, Eye, EyeOff, LoaderCircle, LockKeyhole, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(account, password);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-navy px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-lg bg-brand"><Building2 className="h-6 w-6" /></span><div><p className="text-xl font-bold">中赛 CRM</p><p className="text-sm text-slate-400">ZhongSai Overseas CRM</p></div></div>
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">广告线索 · 全流程跟进</p>
          <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight">让每一条海外广告线索<br />都得到及时跟进</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">统一管理 Meta 与 TikTok 广告客户，清晰记录来源、状态、负责人和每一次沟通。</p>
        </div>
        <p className="text-sm text-slate-500">深圳市中赛钢结构进出口有限公司</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid h-11 w-11 place-items-center rounded-lg bg-brand text-white"><Building2 className="h-6 w-6" /></span><div><p className="text-xl font-bold text-ink">中赛 CRM</p><p className="text-sm text-muted">海外广告线索管理</p></div></div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">欢迎登录</h2>
          <p className="mt-2 text-muted">使用管理员创建的账号进入系统</p>
          <form className="mt-8 space-y-5" onSubmit={submit}>
            <label className="block"><span className="label">手机号或邮箱</span><span className="relative block"><Smartphone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="field pl-10" value={account} onChange={(event) => setAccount(event.target.value)} autoComplete="username" required placeholder="请输入手机号或邮箱" /></span></label>
            <label className="block"><span className="label">密码</span><span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="field px-10" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={8} placeholder="请输入密码" /><button type="button" className="absolute right-0 top-0 grid min-h-11 min-w-11 place-items-center text-slate-500" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
            {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</div>}
            <button className="btn-primary w-full" disabled={submitting}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? '正在登录' : '登录'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}

