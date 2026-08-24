import {
  BarChart3, ClipboardCheck, House, LogOut, Menu, Settings, UserRound,
  UsersRound, X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  mobileLabel?: string;
  icon: typeof House;
  roles: Array<'ADMIN' | 'SALES'>;
}

const navItems: NavItem[] = [
  { to: '/', label: '首页', icon: House, roles: ['ADMIN', 'SALES'] },
  { to: '/leads', label: '客户线索', mobileLabel: '客户', icon: UsersRound, roles: ['ADMIN', 'SALES'] },
  { to: '/review', label: '待核查', icon: ClipboardCheck, roles: ['ADMIN'] },
  { to: '/ads', label: '广告数据', icon: BarChart3, roles: ['ADMIN'] },
  { to: '/users', label: '销售与账号', icon: UserRound, roles: ['ADMIN'] },
  { to: '/settings', label: '系统设置', icon: Settings, roles: ['ADMIN'] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const items = navItems.filter((item) => user && item.roles.includes(user.role));
  const title = navItems.find((item) => item.to !== '/' && location.pathname.startsWith(item.to))?.label ?? (location.pathname.startsWith('/leads/') ? '客户详情' : '首页');

  return (
    <div className="min-h-screen bg-canvas">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-navy text-white transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div><p className="text-xl font-bold tracking-tight">中赛 CRM</p><p className="mt-0.5 text-xs text-slate-400">海外广告线索管理</p></div>
          <button className="grid min-h-11 min-w-11 place-items-center rounded-md lg:hidden" aria-label="关闭菜单" onClick={() => setMenuOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1 p-3" aria-label="主导航">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${isActive ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="h-5 w-5" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-3 bottom-4 space-y-1 border-t border-white/10 pt-3">
          <NavLink to="/profile" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white"><Settings className="h-5 w-5" />个人设置</NavLink>
          <button onClick={() => void logout()} className="flex w-full min-h-11 items-center gap-3 rounded-md px-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-5 w-5" />退出登录</button>
        </div>
      </aside>

      {menuOpen && <button aria-label="关闭菜单遮罩" className="fixed inset-0 z-30 min-h-0 bg-slate-950/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 lg:h-20 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="grid min-h-11 min-w-11 place-items-center rounded-md border border-line lg:hidden" aria-label="打开菜单" onClick={() => setMenuOpen(true)}><Menu className="h-5 w-5" /></button>
            <div><h1 className="text-lg font-semibold text-ink lg:text-xl">{title}</h1><p className="hidden text-xs text-muted sm:block">广告线索 · 全流程跟进管理</p></div>
          </div>
          <NavLink to="/profile" className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-slate-50">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 font-semibold text-brand">{user?.name.slice(0, 1)}</span>
            <span className="hidden text-left sm:block"><span className="block text-sm font-semibold text-ink">{user?.name}</span><span className="block text-xs text-muted">{user?.role === 'ADMIN' ? '管理员' : '销售'}</span></span>
          </NavLink>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-7"><Outlet /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(items.length + 1, 5)}, minmax(0, 1fr))` }} aria-label="手机导航">
        {items.slice(0, 4).map(({ to, mobileLabel, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`}>
            <Icon className="h-5 w-5" />{mobileLabel ?? label}
          </NavLink>
        ))}
        <NavLink to="/profile" className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`}><UserRound className="h-5 w-5" />我的</NavLink>
      </nav>
    </div>
  );
}
