import { useEffect, useState } from 'react';
import { Receipt, Loader2, ArrowUpRight, ShieldCheck, Info } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Badge, Spinner, PageHeader, Modal, btnPrimary, btnGhost } from '../../components/ui/UI';

const INITIAL_RESULT = (() => {
  const p = new URLSearchParams(window.location.search).get('payment');
  if (p === 'success') return { type: 'success', text: 'Payment received — confirming with the gateway, this may take a few seconds...' };
  if (p === 'cancelled') return { type: 'info', text: 'Payment was cancelled. You can try again anytime.' };
  return null;
})();

export default function FeeChallan() {
  const [data, setData] = useState(null);
  const [openChallan, setOpenChallan] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState(INITIAL_RESULT);

  async function refresh() {
    const res = await api.get('/student/challans');
    setData(res.data);
    return res.data;
  }

  useEffect(() => {
    refresh();
    const p = new URLSearchParams(window.location.search).get('payment');
    if (p) {
      // Webhook confirmation is async: re-check shortly after returning from the gateway
      const timer = setTimeout(() => refresh().catch(() => {}), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  async function payNow(challan) {
    setPaying(true);
    setPayResult(null);
    try {
      const res = await api.post('/payments/checkout', { challanId: challan.id });
      if (res.data.url) {
        // Hosted gateway (Stripe Checkout): leave the SPA for the payment page
        window.location.href = res.data.url;
        return;
      }

      async function downloadPdf(challan) {
        const res = await api.get(`/student/challans/${challan.id}/pdf`, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `challan-${challan.voucherId}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      }
      setPayResult({ type: 'success', text: 'Payment recorded — your receipt is in the payment history.' });
      setOpenChallan(null);
      await refresh();
    } catch (err) {
      if (err.response?.status === 402) {
        setPayResult({ type: 'error', text: err.response.data.message || 'Payment was declined' });
      } else {
        setPayResult({ type: 'error', text: apiMessage(err) });
      }
    } finally {
      setPaying(false);
    }
  }

  if (!data) return <Spinner label="Loading fee challans..." />;

  const challans = data.challans || [];
  const amountOf = (c) => Number(c.totalAmount ?? c.amount ?? 0);

  const stats = [
    { label: 'Total Billed', value: `PKR ${challans.reduce((s, c) => s + amountOf(c), 0).toLocaleString()}` },
    { label: 'Amount Paid', value: `PKR ${challans.filter((c) => c.status === 'PAID').reduce((s, c) => s + amountOf(c), 0).toLocaleString()}` },
    { label: 'Outstanding', value: `PKR ${challans.filter((c) => c.status !== 'PAID').reduce((s, c) => s + amountOf(c), 0).toLocaleString()}` },
    { label: 'Payment History', value: `${challans.filter((c) => c.status === 'PAID').length} challans` },
  ];

  return (
    <div>
      <PageHeader
        title="Fee Challans"
        subtitle="View and pay your semester fee challans"
      />

      {payResult && (
        <div className={`rounded-lg px-4 py-3 text-[12px] mb-4 flex items-start gap-2 ${
          payResult.type === 'success' ? 'bg-[#e9f7f0] text-[#0e6b4a]'
            : payResult.type === 'info' ? 'bg-[#eef2fb] text-[#274b9f]'
              : 'bg-[#fde8e8] text-[#a03333]'
        }`}>
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>{payResult.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">{s.label}</span>
            <strong className="block text-[18px] mt-1.5 text-[#172033]">{s.value}</strong>
          </Card>
        ))}
      </div>

      <Card title="Challan History" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                {['Challan #', 'Semester', 'Due Date', 'Amount', 'Status', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {challans.map((c) => (
                <tr key={c.id} className="hover:bg-[#f9fafc]">
                  <td className="px-4 py-3 text-[12px] border-b border-[#edf0f3]">
                    <Receipt size={14} className="inline mr-1.5 text-[#697386] align-middle" />
                    <strong className="text-[#172033]">{c.voucherId}</strong>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{c.semester}</td>
                  <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">
                    {new Date(c.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-[#172033] border-b border-[#edf0f3]">
                    PKR {amountOf(c).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 border-b border-[#edf0f3]">
                    <Badge tone={c.status === 'PAID' ? 'green' : c.status === 'OVERDUE' ? 'red' : 'amber'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 border-b border-[#edf0f3] text-right">
                    <button onClick={() => downloadPdf(c).catch((err) => setPayResult({ type: 'error', text: apiMessage(err) }))} className="mr-2 inline-flex min-h-[44px] items-center gap-1 px-3 py-1.5 text-[11px] rounded-md border border-[#d8dde6] text-[#1e3a8a] hover:bg-[#f3f5f8] transition">
                      PDF
                    </button>
                    <button
                      onClick={() => { setOpenChallan(c); setPayResult(null); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-md bg-[#1e3a8a] text-white hover:bg-[#162f6e] transition border-0"
                    >
                      {c.status === 'PAID' ? 'View' : 'Pay Now'} <ArrowUpRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {challans.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#98a0ae]">No challans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {openChallan && (
        <Modal
          title={openChallan.status === 'PAID' ? 'Challan Details' : 'Online Payment'}
          onClose={() => setOpenChallan(null)}
        >
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between"><span className="text-[#697386]">Challan #</span><strong className="text-[#172033]">{openChallan.voucherId}</strong></div>
            <div className="flex justify-between"><span className="text-[#697386]">Semester</span><strong className="text-[#172033]">{openChallan.semester}</strong></div>
            <div className="flex justify-between"><span className="text-[#697386]">Due Date</span><strong className="text-[#172033]">{new Date(openChallan.dueDate).toLocaleDateString()}</strong></div>
            {openChallan.creditHours ? (
              <div className="flex justify-between"><span className="text-[#697386]">Credit Hours</span><strong className="text-[#172033]">{openChallan.creditHours}</strong></div>
            ) : null}
            <div className="flex justify-between pt-2 border-t border-[#edf0f3]">
              <span className="text-[#697386]">Amount</span>
              <strong className="text-[18px] text-[#172033]">PKR {amountOf(openChallan).toLocaleString()}</strong>
            </div>
            {openChallan.status === 'PAID' ? (
              <div className="flex justify-between"><span className="text-[#697386]">Paid On</span><strong className="text-[#11875d]">{new Date(openChallan.paidAt).toLocaleDateString()}</strong></div>
            ) : (
              <>
                {payResult && (
                  <div className={`rounded-lg px-3 py-2 text-[11px] ${
                    payResult.type === 'success' ? 'bg-[#e9f7f0] text-[#0e6b4a]'
                      : payResult.type === 'info' ? 'bg-[#eef2fb] text-[#274b9f]'
                        : 'bg-[#fde8e8] text-[#a03333]'
                  }`}>{payResult.text}</div>
                )}
                <div className="rounded-xl border border-[#e4e7ec] p-4 bg-[#f9fafc] flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-[#0f9d8a] mt-0.5 shrink-0" />
                  <p className="text-[11px] text-[#465166] m-0">
                    You will be redirected to a secure payment page to complete this payment by card.
                    The challan is marked paid automatically once the payment is confirmed.
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            {openChallan.status !== 'PAID' && (
              <button onClick={() => payNow(openChallan)} disabled={paying} className={btnPrimary}>
                {paying ? <Loader2 size={14} className="animate-spin" /> : 'Proceed to Payment'}
              </button>
            )}
            <button onClick={() => setOpenChallan(null)} className={btnGhost}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
