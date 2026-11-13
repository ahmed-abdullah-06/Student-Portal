import { useEffect, useState } from 'react';
import { Star, Send, CheckCircle2, Lock, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Badge, Spinner, Alert, PageHeader, btnPrimary, btnGhost, inputCls } from '../../components/ui/UI';

function StarInput({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-2.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex flex-col items-center border rounded-lg w-[50px] h-[50px] justify-center transition ${
            n <= value
              ? 'text-[#d18a17] border-[#f1cf93] bg-[#fffaf1]'
              : 'text-[#b5bbc5] border-[#e4e7ec] bg-white hover:border-[#d8dde6]'
          }`}
        >
          <Star size={22} fill={n <= value ? 'currentColor' : 'none'} />
          <span className="text-[8px] mt-0.5">{n}</span>
        </button>
      ))}
    </div>
  );
}

export default function Evaluations() {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);
  const [ratings, setRatings] = useState({ punctuality: 0, knowledge: 0, communication: 0, helpfulness: 0, overall: 0 });
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function load() {
    return api.get('/student/evaluations').then((res) => setData(res.data));
  }

  useEffect(() => {
    load().catch(() => setData({ items: [] }));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (Object.values(ratings).some((v) => !v)) {
      setMsg({ type: 'error', text: 'Please rate all criteria (1–5 stars)' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/student/evaluations', { sectionId: active.sectionId, ...ratings, feedback });
      setMsg({ type: 'success', text: 'Evaluation submitted. Your final result is now unlocked.' });
      setActive(null);
      setRatings({ punctuality: 0, knowledge: 0, communication: 0, helpfulness: 0, overall: 0 });
      setFeedback('');
      load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Spinner label="Loading evaluations..." />;

  return (
    <div>
      <PageHeader
        title="Course Evaluation"
        subtitle="Your feedback is anonymous and helps improve teaching quality"
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}
      {data.allSubmitted && (
        <div className="mb-4"><Alert type="success">All evaluations submitted — your results are now unlocked.</Alert></div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Your Courses" subtitle="Evaluate to unlock your final results" className="p-0 overflow-hidden">
          <div className="px-4 py-2">
            {data.items.map((item) => (
              <button
                key={item.sectionId}
                onClick={() => !item.submitted && setActive(item)}
                disabled={item.submitted}
                className={`w-full text-left rounded-xl px-4 py-3 border transition mb-2 ${
                  active?.sectionId === item.sectionId
                    ? 'border-[#1e3a8a] bg-[#edf2ff]'
                    : item.submitted
                      ? 'border-[#edf0f3] bg-[#f9fafc] cursor-default'
                      : 'border-[#e4e7ec] hover:border-[#8da4f0] bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <strong className="text-[12px] text-[#172033] block">{item.courseCode} — {item.title}</strong>
                    <small className="text-[10px] text-[#697386] block mt-0.5">{item.faculty} · Section {item.section}</small>
                  </div>
                  {item.submitted ? (
                    <Badge tone="green"><CheckCircle2 size={10} className="mr-1" /> Submitted</Badge>
                  ) : (
                    <span className="text-[11px] text-[#1e3a8a] font-medium">Evaluate →</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          {!active ? (
            <div className="py-16 text-center text-[#98a0ae]">
              <Lock className="mx-auto mb-3" size={32} />
              <p className="text-sm">Choose a course from the list to begin</p>
            </div>
          ) : (
            <>
              <div className="px-[18px] pt-4 pb-3 border-b border-[#edf0f3]">
                <h2 className="text-sm font-semibold text-[#172033] m-0">Evaluate: {active.courseCode}</h2>
                <p className="text-[10px] text-[#697386] mt-1 m-0">{active.title} — {active.faculty}</p>
              </div>
              <form onSubmit={submit} className="p-5 space-y-4">
                {[
                  { key: 'punctuality', label: 'Punctuality' },
                  { key: 'knowledge', label: 'Subject Knowledge' },
                  { key: 'communication', label: 'Communication' },
                  { key: 'helpfulness', label: 'Helpfulness' },
                  { key: 'overall', label: 'Overall Rating' },
                ].map((c) => (
                  <div key={c.key}>
                    <span className="block text-[12px] font-semibold text-[#344054] mb-2">{c.label}</span>
                    <StarInput value={ratings[c.key]} onChange={(v) => setRatings({ ...ratings, [c.key]: v })} />
                  </div>
                ))}
                <div>
                  <span className="block text-[12px] font-semibold text-[#344054] mb-2">Comments</span>
                  <textarea
                    placeholder="Share constructive feedback..."
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className={inputCls + ' resize-y'}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={busy} className={btnPrimary}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit Evaluation
                  </button>
                  <button type="button" onClick={() => setActive(null)} className={btnGhost}>Cancel</button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
