import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Alert, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/UI';

export default function AcademicCalendar() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/student/calendar')
      .then((res) => setEvents(res.data.events))
      .catch((err) => setError(apiMessage(err)));
  }, []);
  const grouped = useMemo(() => (events || []).reduce((groups, event) => {
    const key = new Date(event.startsAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    (groups[key] ||= []).push(event);
    return groups;
  }, {}), [events]);

  if (!events && !error) return <Spinner label="Loading academic calendar..." />;
  return (
    <div>
      <PageHeader title="Academic calendar" subtitle="Important university dates, registration windows, and examinations" />
      {error && <Alert>{error}</Alert>}
      {events?.length === 0 && <Card><EmptyState message="No calendar events are scheduled." /></Card>}
      <div className="space-y-4">
        {Object.entries(grouped).map(([month, monthEvents]) => (
          <Card key={month} title={month}>
            <div className="space-y-3">
              {monthEvents.map((event) => (
                <article key={event.id} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <CalendarDays size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{event.title}</h2>
                    <p className="text-xs text-slate-500">
                      {new Date(event.startsAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {event.description && <p className="mt-1 text-xs text-slate-600">{event.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
