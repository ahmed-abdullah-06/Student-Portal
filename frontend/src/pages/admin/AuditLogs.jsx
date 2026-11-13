import { useEffect, useState } from 'react';
import { ScrollText, ShieldCheck, Download, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, Pagination, tableHead, tableCell, btnSecondary } from '../../components/ui/UI';
import VirtualizedList from '../../components/shared/VirtualizedList';

function actionTone(action) {
  if (action.includes('DELET')) return 'red';
  if (action.includes('CREAT') || action.includes('REGISTER')) return 'green';
  if (action.includes('LOGIN')) return 'blue';
  if (action.includes('FROZEN') || action.includes('PASSWORD')) return 'amber';
  return 'slate';
}

export default function AuditLogs() {
  const [logs, setLogs] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [msg, setMsg] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api
      .get(`/admin/audit-logs?page=${page}&limit=${limit}`)
      .then((res) => {
        setLogs(res.data.logs);
        setPagination(res.data.pagination || { page, limit, total: 0, totalPages: 1 });
      })
      .catch(() => setLogs([]));
  }, [page, limit]);

  async function exportCsv() {
    setExporting(true);
    setMsg(null);
    try {
      const res = await api.get('/admin/audit-logs/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setExporting(false);
    }
  }

  if (!logs) return <Spinner label="Loading audit logs..." />;

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable security ledger — every sensitive action with user, entity, and timestamp"
        action={
          <button onClick={exportCsv} disabled={exporting} className={btnSecondary}>
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export CSV
          </button>
        }
      />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <Card
        title="Activity Ledger"
        subtitle={`${pagination.total} entries`}
        className="p-0 overflow-hidden"
        action={<ShieldCheck size={18} className="text-[#1e3a8a]" />}
      >
        {logs.length === 0 ? (
          <div className="p-8 text-center"><Alert type="info">No audit entries yet</Alert></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={tableHead}>Time</th>
                  <th className={tableHead}>Action</th>
                  <th className={tableHead}>User</th>
                  <th className={tableHead}>Entity</th>
                  <th className={tableHead}>Details</th>
                </tr>
              </thead>
              <tbody>
                <VirtualizedList items={logs} rowHeight={42} renderRow={(l, _index, virtualizationStyle) => (
                  <tr key={l.id} style={virtualizationStyle} className="hover:bg-[#f9fafc]">
                    <td className={tableCell + ' text-[10px] text-[#697386] whitespace-nowrap'}>
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className={tableCell}>
                      <Badge tone={actionTone(l.action)}>{l.action}</Badge>
                    </td>
                    <td className={tableCell + ' text-[11px]'}>{l.user?.email || 'system'}</td>
                    <td className={tableCell + ' text-[11px] text-[#697386]'}>
                      {l.entity}
                      {l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ''}
                    </td>
                    <td className={tableCell + ' text-[11px] text-[#697386] max-w-md truncate'}>
                      {l.details || '—'}
                      {l.ipAddress && <span className="text-[#98a0ae] ml-2">({l.ipAddress})</span>}
                    </td>
                  </tr>
                )} />
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={limit}
          onPage={setPage}
          onLimit={(n) => { setLimit(n); setPage(1); }}
        />
      </Card>

      <div className="text-[10px] text-[#98a0ae] flex items-center gap-1.5 mt-3">
        <ScrollText size={12} /> Retention window is configurable under Settings → Retention.
      </div>
    </div>
  );
}
