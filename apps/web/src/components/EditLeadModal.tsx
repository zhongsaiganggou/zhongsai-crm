import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import type { Lead } from '../types';
import { Modal } from './Modal';

interface EditLeadModalProps {
  lead: Lead | null;
  onClose: () => void;
}

export function EditLeadModal({ lead, onClose }: EditLeadModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api(`/leads/${lead?.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
    onSuccess: async () => {
      toast('客户资料已更新');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lead', lead?.id] }),
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
      ]);
      onClose();
    },
    onError: (error) => toast(error instanceof Error ? error.message : '保存失败', 'error'),
  });

  if (!lead) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (name: string) => String(values.get(name) ?? '').trim();
    const optional = (name: string) => text(name) || undefined;
    const budget = optional('estimatedBudget');
    update.mutate({
      name: optional('name'),
      countryCode: optional('countryCode')?.toUpperCase(),
      countryName: optional('countryName'),
      city: optional('city'),
      companyName: optional('companyName'),
      jobTitle: optional('jobTitle'),
      wechatId: optional('wechatId'),
      whatsapp: optional('whatsapp'),
      phone: optional('phone'),
      email: optional('email'),
      projectType: optional('projectType'),
      projectDescription: optional('projectDescription'),
      purchaseTimeline: optional('purchaseTimeline'),
      expectedPurchaseDate: optional('expectedPurchaseDate'),
      estimatedBudget: budget ? Number(budget) : undefined,
      budgetCurrency: optional('budgetCurrency')?.toUpperCase(),
      remark: optional('remark'),
    });
  };

  return (
    <Modal
      open
      title="编辑客户资料"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
          <button type="submit" form="edit-lead-form" className="btn-primary" disabled={update.isPending}>
            {update.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存修改
          </button>
        </>
      )}
    >
      <form id="edit-lead-form" key={formKey} className="space-y-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="客户姓名" name="name" defaultValue={lead.name} maxLength={200} />
          <Field label="国家代码" name="countryCode" defaultValue={lead.countryCode} maxLength={2} placeholder="例如 NG" />
          <Field label="国家/地区" name="countryName" defaultValue={lead.countryName} maxLength={100} />
          <Field label="城市" name="city" defaultValue={lead.city} maxLength={100} />
          <Field label="公司名称" name="companyName" defaultValue={lead.companyName} maxLength={200} />
          <Field label="职位" name="jobTitle" defaultValue={lead.jobTitle} maxLength={150} />
          <Field label="微信号" name="wechatId" defaultValue={lead.wechatId} maxLength={100} />
          <Field label="WhatsApp" name="whatsapp" defaultValue={lead.whatsappRaw} maxLength={100} />
          <Field label="电话号码" name="phone" defaultValue={lead.phoneRaw} maxLength={100} />
          <Field label="邮箱" name="email" type="email" defaultValue={lead.email} maxLength={255} />
          <label>
            <span className="label">项目类型</span>
            <select className="field" name="projectType" defaultValue={lead.projectType ?? ''}>
              <option value="">未填写</option>
              <option value="INDUSTRIAL_PLANT">工业厂房</option>
              <option value="WAREHOUSE">仓库</option>
              <option value="STEEL_BUILDING">钢结构建筑</option>
              <option value="OTHER">其他</option>
            </select>
          </label>
          <label>
            <span className="label">采购时间</span>
            <select className="field" name="purchaseTimeline" defaultValue={lead.purchaseTimeline ?? ''}>
              <option value="">未填写</option>
              <option value="WITHIN_1_MONTH">1个月内</option>
              <option value="ONE_TO_THREE_MONTHS">1至3个月</option>
              <option value="THREE_TO_SIX_MONTHS">3至6个月</option>
              <option value="OVER_SIX_MONTHS">6个月以上</option>
              <option value="UNKNOWN">暂不确定</option>
            </select>
          </label>
          <Field label="预计采购日期" name="expectedPurchaseDate" type="date" defaultValue={lead.expectedPurchaseDate?.slice(0, 10)} />
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <Field label="预计预算" name="estimatedBudget" type="number" defaultValue={lead.estimatedBudget} min="0" step="0.01" />
            <Field label="币种" name="budgetCurrency" defaultValue={lead.budgetCurrency ?? 'USD'} maxLength={3} />
          </div>
        </div>
        <label className="block">
          <span className="label">项目描述</span>
          <textarea className="field min-h-28" name="projectDescription" maxLength={10_000} defaultValue={lead.projectDescription ?? ''} />
        </label>
        <label className="block">
          <span className="label">备注</span>
          <textarea className="field min-h-24" name="remark" maxLength={10_000} defaultValue={lead.remark ?? ''} />
        </label>
        <button type="button" className="text-sm text-muted underline" onClick={() => setFormKey((value) => value + 1)}>
          撤销本次未保存修改
        </button>
      </form>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  min?: string;
  step?: string;
}

function Field({ label, defaultValue, ...input }: FieldProps) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" defaultValue={defaultValue ?? ''} {...input} />
    </label>
  );
}
