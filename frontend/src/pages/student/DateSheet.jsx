import { useEffect, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import api from '../../services/api';
import { Card, Spinner, PageHeader, Badge, Tabs, btnSecondary, tableHead, tableCell } from '../../components/ui/UI';
import Avatar from '../../components/shared/Avatar';

export default function DateSheet() {
  const [data, setData] = useState(null);
  const [admit, setAdmit] = useState(null);
  const [tab, setTab] = useState('Date Sheet');

  useEffect(() => {
    api.get('/student/date-sheet').then((res) => setData(res.data)).catch(() => setData({ exams: [], student: {} }));
  }, []);

  function loadAdmit(type) {
    setAdmit(null);
    api.get(`/student/admit-card?type=${type}`).then((res) => setAdmit(res.data)).catch(() => {});
  }

  async function downloadAdmitCard() {
    if (!admit?.type) return;
    const res = await api.get(`/student/admit-card/pdf?type=${admit.type}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admit-card-${admit.type.toLowerCase()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <Spinner label="Loading date sheet..." />;

  return (
    <div>
      <PageHeader
        title="Exams"
        subtitle="Date sheet and admit card for mid-term and final examinations"
      />

      <Card className="p-0 overflow-hidden mb-4">
        <Tabs tabs={['Date Sheet', 'Admit Card']} active={tab} onChange={(t) => { setTab(t); if (t === 'Admit Card') loadAdmit('MIDTERM'); }} />

        {tab === 'Date Sheet' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className={tableHead}>Date</th>
                  <th className={tableHead}>Day</th>
                  <th className={tableHead}>Course</th>
                  <th className={tableHead}>Title</th>
                  <th className={tableHead}>Time</th>
                  <th className={tableHead}>Room</th>
                  <th className={tableHead}>Type</th>
                </tr>
              </thead>
              <tbody>
                {data.exams.map((e) => (
                  <tr key={e.id} className="hover:bg-[#f9fafc]">
                    <td className={tableCell + ' font-semibold'}>{new Date(e.date).toLocaleDateString()}</td>
                    <td className={tableCell}>{new Date(e.date).toLocaleDateString('en', { weekday: 'long' })}</td>
                    <td className={tableCell + ' font-mono font-semibold text-[#1e3a8a]'}>{e.section?.course?.courseCode}</td>
                    <td className={tableCell}>{e.section?.course?.title}</td>
                    <td className={tableCell}>{e.startTime} – {e.endTime}</td>
                    <td className={tableCell}>{e.room || 'TBA'}</td>
                    <td className={tableCell}><Badge tone={e.type === 'MIDTERM' ? 'amber' : 'red'}>{e.type}</Badge></td>
                  </tr>
                ))}
                {data.exams.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-[#98a0ae]">No exams scheduled yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Admit Card' && (
          <div className="p-5">
            <div className="flex gap-2 mb-4">
              <button onClick={() => loadAdmit('MIDTERM')} className={btnSecondary + (admit?.type === 'MIDTERM' ? ' border-[#1e3a8a] text-[#1e3a8a]' : '')}>
                Mid-Term
              </button>
              <button onClick={() => loadAdmit('FINAL')} className={btnSecondary + (admit?.type === 'FINAL' ? ' border-[#1e3a8a] text-[#1e3a8a]' : '')}>
                Final
              </button>
            </div>

            {admit && (
              <div className="border border-[#e4e7ec] rounded-lg overflow-hidden max-w-[640px]">
                <div className="bg-[#1e3a8a] text-white px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] tracking-[2px] text-[#a8eee4] font-bold">NOVASTRA UNIVERSITY</div>
                    <div className="text-lg font-bold mt-1">Admit Card — {admit.type === 'MIDTERM' ? 'Mid-Term' : 'Final'} Examination</div>
                  </div>
                  <CalendarDays size={28} />
                </div>
                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-[#edf0f3]">
                  <div>
                    <span className="block text-[9px] text-[#697386] uppercase">Name</span>
                    <span className="inline-flex items-center gap-2"><Avatar name={admit.student?.name || 'Student'} src={admit.student?.photoUrl} size="h-8 w-8" /><strong className="text-sm">{admit.student?.name}</strong></span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#697386] uppercase">Roll Number</span>
                    <strong className="text-sm font-mono">{admit.student?.rollNumber}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#697386] uppercase">Program</span>
                    <strong className="text-sm">{admit.student?.program} — Sem {admit.student?.currentSemester}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#697386] uppercase">Batch</span>
                    <strong className="text-sm">{admit.student?.batch}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#697386] uppercase">Department</span>
                    <strong className="text-sm">{admit.student?.department}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#697386] uppercase">Exams</span>
                    <strong className="text-sm">{admit.exams?.length || 0} papers</strong>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#697386] mb-3">Exam Schedule</div>
                  {admit.exams?.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b border-[#edf0f3] last:border-0">
                      <div>
                        <strong className="text-[12px] text-[#1e3a8a] font-mono">{e.section?.course?.courseCode}</strong>
                        <span className="text-[11px] text-[#697386] ml-2">{e.section?.course?.title}</span>
                      </div>
                      <div className="text-right text-[11px]">
                        <div className="font-semibold">{new Date(e.date).toLocaleDateString()} · {e.startTime}–{e.endTime}</div>
                        <div className="text-[#98a0ae]">{e.room || 'TBA'}</div>
                      </div>
                    </div>
                  ))}
                  {!admit.exams?.length && <p className="text-sm text-[#98a0ae]">No {admit.type.toLowerCase()} exams scheduled.</p>}
                </div>
                <div className="px-6 pb-4 text-[9px] text-[#98a0ae]">
                  * Bring your university ID card. Mobile phones are strictly prohibited in the exam hall.
                </div>
                <div className="px-6 pb-5">
                  <button type="button" onClick={downloadAdmitCard} className={btnSecondary}>
                    <Download size={15} /> Download branded PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
