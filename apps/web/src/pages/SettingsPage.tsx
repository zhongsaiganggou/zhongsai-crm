import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ErrorState, Loading } from '../components/Feedback';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import type { User } from '../types';

interface AssignmentRule {
  type: 'country' | 'project_type';
  countries?: string[];
  projectTypes?: string[];
  userId: string;
}

interface AssignmentConfig {
  enabled: boolean;
  mode: 'round_robin' | 'load_balance' | 'rule_based';
  rules: AssignmentRule[];
  defaultUserId?: string;
  roundRobinIndex: number;
}

interface PoolReclaimConfig {
  enabled: boolean;
  reclaimAfterDays: number;
  excludeStatuses: string[];
  notifyBeforeDays: number;
}

const projectTypeOptions = [
  { value: 'INDUSTRIAL_PLANT', label: '工业厂房' },
  { value: 'WAREHOUSE', label: '仓库' },
  { value: 'STEEL_BUILDING', label: '钢结构建筑' },
  { value: 'OTHER', label: '其他' },
];

const countryOptions = [
  { value: 'NG', label: '尼日利亚' },
  { value: 'SA', label: '沙特阿拉伯' },
  { value: 'AE', label: '阿联酋' },
  { value: 'BR', label: '巴西' },
  { value: 'MY', label: '马来西亚' },
  { value: 'KE', label: '肯尼亚' },
  { value: 'ID', label: '印度尼西亚' },
  { value: 'PE', label: '秘鲁' },
  { value: 'ET', label: '埃塞俄比亚' },
  { value: 'ZA', label: '南非' },
  { value: 'VN', label: '越南' },
  { value: 'OM', label: '阿曼' },
  { value: 'MX', label: '墨西哥' },
  { value: 'PH', label: '菲律宾' },
  { value: 'TH', label: '泰国' },
];

export function SettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const assignmentQuery = useQuery({
    queryKey: ['assignment-config'],
    queryFn: () => api<AssignmentConfig>('/leads/assignment-config'),
  });

  const poolQuery = useQuery({
    queryKey: ['pool-config'],
    queryFn: () => api<PoolReclaimConfig>('/leads/pool-config'),
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api<User[]>('/users'),
  });

  const [assignmentConfig, setAssignmentConfig] = useState<AssignmentConfig | null>(null);
  const [poolConfig, setPoolConfig] = useState<PoolReclaimConfig | null>(null);
  const [newRuleType, setNewRuleType] = useState<'country' | 'project_type'>('country');
  const [newRuleCountries, setNewRuleCountries] = useState<string[]>([]);
  const [newRuleProjectTypes, setNewRuleProjectTypes] = useState<string[]>([]);
  const [newRuleUserId, setNewRuleUserId] = useState('');

  useEffect(() => {
    if (assignmentQuery.data) setAssignmentConfig(assignmentQuery.data);
  }, [assignmentQuery.data]);

  useEffect(() => {
    if (poolQuery.data) setPoolConfig(poolQuery.data);
  }, [poolQuery.data]);

  const updateAssignment = (patch: Partial<AssignmentConfig>) => {
    setAssignmentConfig((current) => current ? { ...current, ...patch } : current);
  };
  const updatePool = (patch: Partial<PoolReclaimConfig>) => {
    setPoolConfig((current) => current ? { ...current, ...patch } : current);
  };

  const saveAssignment = useMutation({
    mutationFn: (config: AssignmentConfig) =>
      api('/leads/assignment-config', { method: 'PUT', body: JSON.stringify(config) }),
    onSuccess: () => {
      toast('分配规则已保存');
      void queryClient.invalidateQueries({ queryKey: ['assignment-config'] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : '保存失败', 'error'),
  });

  const savePool = useMutation({
    mutationFn: (config: PoolReclaimConfig) =>
      api('/leads/pool-config', { method: 'PUT', body: JSON.stringify(config) }),
    onSuccess: () => {
      toast('公海回收规则已保存');
      void queryClient.invalidateQueries({ queryKey: ['pool-config'] });
    },
    onError: (error) => toast(error instanceof Error ? error.message : '保存失败', 'error'),
  });

  const addRule = () => {
    if (!assignmentConfig || !newRuleUserId) return;
    const rule: AssignmentRule = {
      type: newRuleType,
      userId: newRuleUserId,
      ...(newRuleType === 'country' ? { countries: newRuleCountries } : { projectTypes: newRuleProjectTypes }),
    };
    setAssignmentConfig({ ...assignmentConfig, rules: [...assignmentConfig.rules, rule] });
    setNewRuleCountries([]);
    setNewRuleProjectTypes([]);
    setNewRuleUserId('');
  };

  const removeRule = (index: number) => {
    if (!assignmentConfig) return;
    setAssignmentConfig({
      ...assignmentConfig,
      rules: assignmentConfig.rules.filter((_, i) => i !== index),
    });
  };

  const handleSubmitAssignment = (e: FormEvent) => {
    e.preventDefault();
    if (assignmentConfig) saveAssignment.mutate(assignmentConfig);
  };

  const handleSubmitPool = (e: FormEvent) => {
    e.preventDefault();
    if (poolConfig) savePool.mutate(poolConfig);
  };

  if (assignmentQuery.isLoading || poolQuery.isLoading || usersQuery.isLoading) {
    return <Loading label="正在加载配置" />;
  }
  if (assignmentQuery.error || poolQuery.error || usersQuery.error) {
    return <ErrorState error={assignmentQuery.error || poolQuery.error || usersQuery.error!} retry={() => { void assignmentQuery.refetch(); void poolQuery.refetch(); void usersQuery.refetch(); }} />;
  }

  const salesUsers = usersQuery.data?.filter((u) => u.role === 'SALES' && u.status === 'ACTIVE') ?? [];

  return (
    <div className="space-y-6">
      {/* 自动分配规则 */}
      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">自动分配规则</h2>
            <p className="mt-1 text-sm text-muted">配置新线索自动分配给销售的规则</p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={assignmentConfig?.enabled ?? false}
              onChange={(e) => updateAssignment({ enabled: e.target.checked })}
              className="h-5 w-5"
            />
            <span className="text-sm font-medium">启用自动分配</span>
          </label>
        </div>

        <form onSubmit={handleSubmitAssignment} className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">分配模式</span>
              <select
                className="field"
                value={assignmentConfig?.mode ?? 'load_balance'}
                onChange={(e) => updateAssignment({ mode: e.target.value as AssignmentConfig['mode'] })}
              >
                <option value="load_balance">负载均衡（分配给线索最少的销售）</option>
                <option value="round_robin">轮询分配（按顺序轮流）</option>
                <option value="rule_based">规则优先（按国家/产品类型匹配）</option>
              </select>
            </label>
            <label>
              <span className="label">默认分配人（规则未匹配时）</span>
              <select
                className="field"
                value={assignmentConfig?.defaultUserId ?? ''}
                onChange={(e) => updateAssignment({ defaultUserId: e.target.value || undefined })}
              >
                <option value="">不分配（进入公海）</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          </div>

          {/* 规则列表 */}
          <div>
            <h3 className="mb-3 font-semibold text-ink">分配规则</h3>
            {assignmentConfig?.rules.length === 0 && (
              <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-muted">暂无规则，点击下方添加</p>
            )}
            <div className="space-y-2">
              {assignmentConfig?.rules.map((rule, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-line bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {rule.type === 'country' ? '按国家' : '按产品类型'}
                    </span>
                    <span className="text-sm text-ink">
                      {rule.type === 'country'
                        ? rule.countries?.map((c) => countryOptions.find((o) => o.value === c)?.label || c).join('、')
                        : rule.projectTypes?.map((p) => projectTypeOptions.find((o) => o.value === p)?.label || p).join('、')}
                    </span>
                    <span className="text-sm text-muted">→</span>
                    <span className="text-sm font-medium text-ink">
                      {salesUsers.find((u) => u.id === rule.userId)?.name || '未知用户'}
                    </span>
                  </div>
                  <button type="button" onClick={() => removeRule(index)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 添加规则表单 */}
          <div className="rounded-lg border border-line p-4">
            <h4 className="mb-3 text-sm font-semibold text-ink">添加新规则</h4>
            <div className="grid gap-3 sm:grid-cols-4">
              <label>
                <span className="label">规则类型</span>
                <select className="field" value={newRuleType} onChange={(e) => setNewRuleType(e.target.value as 'country' | 'project_type')}>
                  <option value="country">按国家</option>
                  <option value="project_type">按产品类型</option>
                </select>
              </label>
              {newRuleType === 'country' ? (
                <label className="sm:col-span-2">
                  <span className="label">国家（可多选，按住Ctrl）</span>
                  <select
                    className="field min-h-24"
                    multiple
                    value={newRuleCountries}
                    onChange={(e) => setNewRuleCountries(Array.from(e.target.selectedOptions, (o) => o.value))}
                  >
                    {countryOptions.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="sm:col-span-2">
                  <span className="label">产品类型（可多选，按住Ctrl）</span>
                  <select
                    className="field min-h-24"
                    multiple
                    value={newRuleProjectTypes}
                    onChange={(e) => setNewRuleProjectTypes(Array.from(e.target.selectedOptions, (o) => o.value))}
                  >
                    {projectTypeOptions.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span className="label">分配给</span>
                <select className="field" value={newRuleUserId} onChange={(e) => setNewRuleUserId(e.target.value)}>
                  <option value="">请选择销售</option>
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={addRule}
              disabled={!newRuleUserId || (newRuleType === 'country' ? newRuleCountries.length === 0 : newRuleProjectTypes.length === 0)}
              className="btn-secondary mt-3"
            >
              <Plus className="h-4 w-4" />添加规则
            </button>
          </div>

          <button type="submit" disabled={saveAssignment.isPending} className="btn-primary">
            {saveAssignment.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />保存分配规则
          </button>
        </form>
      </section>

      {/* 公海回收规则 */}
      <section className="surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">公海回收规则</h2>
            <p className="mt-1 text-sm text-muted">超时未跟进的线索自动回收到公海，可重新分配</p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={poolConfig?.enabled ?? false}
              onChange={(e) => updatePool({ enabled: e.target.checked })}
              className="h-5 w-5"
            />
            <span className="text-sm font-medium">启用公海回收</span>
          </label>
        </div>

        <form onSubmit={handleSubmitPool} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">回收天数（超过N天未跟进自动回收）</span>
              <input
                type="number"
                className="field"
                min={1}
                max={30}
                value={poolConfig?.reclaimAfterDays ?? 7}
                onChange={(e) => updatePool({ reclaimAfterDays: parseInt(e.target.value) || 7 })}
              />
            </label>
            <label>
              <span className="label">提前提醒天数（回收前N天提醒）</span>
              <input
                type="number"
                className="field"
                min={0}
                max={7}
                value={poolConfig?.notifyBeforeDays ?? 1}
                onChange={(e) => updatePool({ notifyBeforeDays: parseInt(e.target.value) || 1 })}
              />
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted">
              排除状态：成交(WON)、无效(INVALID)、流失(LOST) 的线索不会被回收。
            </p>
          </div>

          <button type="submit" disabled={savePool.isPending} className="btn-primary">
            {savePool.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />保存公海回收规则
          </button>
        </form>
      </section>

      {/* 说明 */}
      <section className="surface p-6">
        <h2 className="text-xl font-bold text-ink">使用说明</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <p><strong>自动分配：</strong>新线索创建后，根据配置的规则自动分配给对应销售。规则优先匹配，未匹配则按分配模式处理。</p>
          <p><strong>负载均衡：</strong>分配给当前未成交线索数量最少的销售，确保工作量均衡。</p>
          <p><strong>轮询分配：</strong>按销售列表顺序轮流分配，适合线索量较大的场景。</p>
          <p><strong>公海回收：</strong>每天凌晨2点自动检查，超过设定天数未跟进的线索回收到公海，其他销售可主动领取。</p>
          <p><strong>手动操作：</strong>在客户详情页，管理员可手动分配/回收线索，销售可从公海领取线索。</p>
        </div>
      </section>
    </div>
  );
}
