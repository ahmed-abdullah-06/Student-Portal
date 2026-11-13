import { useEffect, useState } from 'react';
import { Star, MessageSquareQuote } from 'lucide-react';
import api from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader } from '../../components/ui/UI';
import { SectionPicker } from './MarkAttendance';

function Bar({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[#465166] w-32">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[#edf0f3] overflow-hidden">
        <div className="h-full rounded-full bg-[#d18a17]" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="text-[12px] font-semibold w-8 text-right text-[#172033]">{value.toFixed(1)}</span>
    </div>
  );
}

export default function FacultyEvaluations() {
  const [sections, setSections] = useState(null);
  const [section, setSection] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/faculty/sections').then((res) => {
      setSections(res.data.sections);
      if (res.data.sections.length) pick(res.data.sections[0]);
    });
  }, []);

  async function pick(s) {
    setSection(s);
    setData(null);
    const res = await api.get(`/faculty/sections/${s.id}/evaluations`);
    setData(res.data);
  }

  if (!sections) return <Spinner label="Loading..." />;

  return (
    <div>
      <PageHeader
        title="Student Evaluations"
        subtitle="Anonymous feedback — individual students are never identified"
      />

      <SectionPicker sections={sections} value={section} onChange={pick} />

      {section && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <Card
            title="Rating Averages"
            subtitle={`${section.course.courseCode} — Section ${section.name}`}
            className="lg:col-span-2 p-0 overflow-hidden"
            action={<Badge tone={data.averages.overall >= 4 ? 'green' : data.averages.overall >= 3 ? 'amber' : 'red'}>Overall {data.averages.overall}/5</Badge>}
          >
            <div className="px-[18px] py-4">
              {data.count === 0 ? (
                <Alert type="info">No evaluations submitted yet</Alert>
              ) : (
                <div className="space-y-3.5">
                  <Bar label="Punctuality" value={data.averages.punctuality} />
                  <Bar label="Knowledge" value={data.averages.knowledge} />
                  <Bar label="Communication" value={data.averages.communication} />
                  <Bar label="Helpfulness" value={data.averages.helpfulness} />
                  <Bar label="Overall" value={data.averages.overall} />
                </div>
              )}
            </div>
          </Card>

          <Card title="Written Feedback" subtitle={`${data.feedback.length} comments`} className="p-0 overflow-hidden">
            <div className="px-[18px] py-3">
              {data.feedback.length === 0 ? (
                <p className="text-[12px] text-[#98a0ae] text-center py-6">No written feedback</p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {data.feedback.map((f, i) => (
                    <div key={i} className="bg-[#f6f8fc] border border-[#edf0f3] rounded-lg p-3 text-[12px] text-[#465166] flex gap-2">
                      <MessageSquareQuote size={14} className="text-[#1e3a8a] shrink-0 mt-0.5" />
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {data && data.count > 0 && (
        <div className="text-center text-[10px] text-[#98a0ae] mt-4">
          <Star size={12} className="inline text-[#d18a17] mr-1" /> Based on {data.count} anonymous submissions
        </div>
      )}
    </div>
  );
}
