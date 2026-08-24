import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { communicationLabels } from '../lib/labels';
import type { CommunicationMethod, Lead, LeadStatus } from '../types';
import { Modal } from './Modal';

export function FollowUpModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const statuses = useQuery({ queryKey: ['lead-statuses'], queryFn: () => api<LeadStatus[]>('/leads/statuses'), enabled: Boolean(lead) });
  const [method, setMethod] = useState<CommunicationMethod>('WHATSAPP');
  const [content, setContent] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [statusId, setStatusId] = useState('');
  const mutation = useMutation({
    mutationFn: () => api(`/leads/${lead!.id}/follow-ups`, {
      method: 'POST',
      body: JSON.stringify({ communicationMethod: method, content, nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : undefined, statusId: statusId || undefined }),
    }),
    onSuccess: async () => {
      toast('跟进记录已保存');
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['lead', lead?.id] });
      await queryClient.invalidateQueries({ queryKey: ['overview'] });
      onClose();
      setContent(''); setNextFollowUpAt(''); setStatusId('');
    },
    onError: (error) => toast(error instanceof Error ? error.message : '保存失败', 'error'),
  });

  const submit = (event: FormEvent) => { event.preventDefault(); mutation.mutate(); };

  return (
    <Modal open={Boolean(lead)} title={`添加跟进 · ${lead?.name || '姓名未提供'}`} onClose={onClose} footer={<><button className="btn-secondary" onClick={onClose}>取消</button><button className="btn-primary" form="follow-up-form" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}保存跟进</button></>}>
      <form id="follow-up-form" className="space-y-4" onSubmit={submit}>
        <label className="block"><span className="label">沟通方式</span><select className="field" value={method} onChange={(event) => setMethod(event.target.value as CommunicationMethod)}>{Object.entries(communicationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block"><span className="label">跟进内容</span><textarea className="field min-h-32 resize-y" value={content} onChange={(event) => setContent(event.target.value)} required placeholder="记录客户需求、沟通结果和下一步安排" /></label>
        <label className="block"><span className="label">下一次跟进时间</span><input className="field" type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} /></label>
        <label className="block"><span className="label">同步修改客户状态</span><select className="field" value={statusId} onChange={(event) => setStatusId(event.target.value)}><option value="">保持当前状态</option>{statuses.data?.filter((status) => status.code !== 'INVALID').map((status) => <option key={status.id} value={status.id}>{status.nameZh}</option>)}</select></label>
      </form>
    </Modal>
  );
}

