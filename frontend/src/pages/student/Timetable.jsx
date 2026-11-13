import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import api from '../../services/api';
import { Card, Spinner, PageHeader, btnSecondary } from '../../components/ui/UI';

const DAYS = [
  { key: 'Monday', short: 'MON', date: '12' },
  { key: 'Tuesday', short: 'TUE', date: '13' },
  { key: 'Wednesday', short: 'WED', date: '14' },
  { key: 'Thursday', short: 'THU', date: '15' },
  { key: 'Friday', short: 'FRI', date: '16' },
  { key: 'Saturday', short: 'SAT', date: '17' },
];

const TIMES = ['08:00', '09:00', '10:00', '10:30', '11:00', '12:00', '13:00', '14:00', '15:00'];

const blockColors = [
  { bg: '#eef2ff', border: '#1e3a8a', text: '#1e3a8a' },
  { bg: '#eaf9f6', border: '#0f9d8a', text: '#0b7466' },
  { bg: '#fff5e3', border: '#d18a17', text: '#a06e10' },
  { bg: '#f4effc', border: '#7854ad', text: '#5e3f8a' },
];

export default function Timetable() {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    api.get('/student/timetable').then((res) => setEntries(res.data.entries));
  }, []);

  if (!entries) return <Spinner label="Loading timetable..." />;

  const uniqueCodes = [...new Set(entries.map((e) => e.courseCode))];
  const codeColorMap = {};
  uniqueCodes.forEach((code, i) => {
    codeColorMap[code] = blockColors[i % blockColors.length];
  });

  return (
    <div>
      <PageHeader
        title="Weekly Timetable"
        subtitle="Fall 2026 • Your class schedule"
        action={
          <button className={btnSecondary}>
            <Download size={16} /> Download
          </button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid" style={{ gridTemplateColumns: '80px repeat(6, 1fr)' }}>
              <div className="h-[58px] flex items-center justify-center bg-[#f9fafc] border-b border-[#e4e7ec] text-[10px] font-semibold text-[#697386]">
                TIME
              </div>
              {DAYS.map((d) => (
                <div key={d.key} className="h-[58px] flex flex-col items-center justify-center bg-[#f9fafc] border-b border-l border-[#e4e7ec] text-[10px] font-semibold">
                  {d.short}
                  <small className="text-[8px] text-[#697386] mt-0.5">{d.date} OCT</small>
                </div>
              ))}

              {TIMES.map((time, ti) => (
                <div key={time} className="contents">
                  <div className="min-h-[96px] flex flex-col items-center pt-[18px] text-[10px] text-[#465166] border-b border-[#e4e7ec] border-r-[1px]">
                    {time}
                    <small className="text-[7px] text-[#697386] mt-0.5">{ti < 4 ? 'AM' : 'PM'}</small>
                  </div>
                  {DAYS.map((day) => {
                    const classEntry = entries.find(
                      (e) => e.day === day.key && e.startTime === time
                    );
                    const color = classEntry ? codeColorMap[classEntry.courseCode] : null;
                    return (
                      <div key={day.key + time} className="min-h-[96px] p-[7px] border-b border-l border-[#e4e7ec] flex items-stretch">
                        {classEntry && (
                          <div
                            className="rounded-md p-2 w-full flex flex-col border-l-[3px]"
                            style={{ background: color.bg, borderLeftColor: color.border }}
                          >
                            <strong className="text-[9px]" style={{ color: color.text }}>{classEntry.courseCode}</strong>
                            <span className="text-[8px] my-0.5 text-[#4b5668]">{classEntry.section}</span>
                            <small className="text-[7px] text-[#798396]">{classEntry.room}</small>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 flex flex-wrap gap-3 border-t border-[#edf0f3]">
          {uniqueCodes.map((code) => (
            <span key={code} className="inline-flex items-center gap-1.5 text-[10px] text-[#465166] font-medium">
              <span className="w-2 h-2 rounded-full" style={{ background: codeColorMap[code].border }} />
              {code}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
