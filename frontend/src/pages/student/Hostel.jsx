import { useEffect, useState } from 'react';
import { Home, Utensils, MapPin } from 'lucide-react';
import api from '../../services/api';
import { Card, Badge, Spinner, PageHeader } from '../../components/ui/UI';

export default function Hostel() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/student/hostel').then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  if (!data) return <Spinner label="Loading hostel info..." />;

  const resident = data.resident;
  const mess = data.mess;

  return (
    <div>
      <PageHeader
        title="Hostel"
        subtitle="Your hostel allotment, room details and mess information"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 flex items-start gap-3.5">
          <div className="w-[42px] h-[42px] rounded-[10px] bg-[#edf2ff] text-[#1e3a8a] grid place-items-center shrink-0">
            <Home size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">Hostel Status</span>
            <strong className="block text-[15px] mt-1 text-[#172033]">
              {resident ? 'Allotted' : 'Not Allotted'}
            </strong>
            <small className="block text-[10px] text-[#98a0ae] mt-0.5">
              {resident ? `${resident.hostelName}` : 'Apply at the hostel office'}
            </small>
          </div>
        </Card>

        <Card className="p-5 flex items-start gap-3.5">
          <div className="w-[42px] h-[42px] rounded-[10px] bg-[#eaf9f6] text-[#0f9d8a] grid place-items-center shrink-0">
            <MapPin size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">Room</span>
            <strong className="block text-[15px] mt-1 text-[#172033]">
              {resident ? `Room ${resident.roomNumber}` : '—'}
            </strong>
            <small className="block text-[10px] text-[#98a0ae] mt-0.5">
              {resident ? `Block ${resident.block} · ${resident.floor || '—'}` : 'No room assigned'}
            </small>
          </div>
        </Card>

        <Card className="p-5 flex items-start gap-3.5">
          <div className="w-[42px] h-[42px] rounded-[10px] bg-[#fff5e3] text-[#d18a17] grid place-items-center shrink-0">
            <Utensils size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">Mess Plan</span>
            <strong className="block text-[15px] mt-1 text-[#172033]">
              {mess ? 'Subscribed' : 'Not Subscribed'}
            </strong>
            <small className="block text-[10px] text-[#98a0ae] mt-0.5">
              {mess ? `${mess.plan || 'Standard'} — PKR ${mess.monthlyFee || '—'}/month` : 'Subscribe at the mess office'}
            </small>
          </div>
        </Card>
      </div>

      {resident ? (
        <Card title="Allotment Details" className="p-0 overflow-hidden">
          <div className="px-[18px]">
            {[
              ['Hostel', resident.hostelName],
              ['Room Number', resident.roomNumber],
              ['Block', resident.block],
              ['Floor', resident.floor || '—'],
              ['Allotment Date', resident.allotmentDate ? new Date(resident.allotmentDate).toLocaleDateString() : '—'],
              ['Status', resident.status || 'Active'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-3.5 border-b border-[#e4e7ec] last:border-0">
                <span className="text-[12px] text-[#697386]">{k}</span>
                <strong className="text-[12px] text-[#172033]">{v}</strong>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-10 text-center">
          <Home className="mx-auto mb-3 text-[#b5bbc5]" size={36} />
          <h3 className="text-[15px] font-semibold text-[#172033] mb-1">No hostel allotment</h3>
          <p className="text-[12px] text-[#697386] mb-5">
            You have not been allotted a hostel room for the current semester.
          </p>
          <Badge tone="amber">Application pending review</Badge>
        </Card>
      )}

      {mess && (
        <Card title="Mess Information" className="mt-4 p-0 overflow-hidden">
          <div className="px-[18px]">
            {[
              ['Mess Plan', mess.plan || 'Standard'],
              ['Monthly Fee', `PKR ${mess.monthlyFee || '—'}`],
              ['Start Date', mess.startDate ? new Date(mess.startDate).toLocaleDateString() : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-3.5 border-b border-[#e4e7ec] last:border-0">
                <span className="text-[12px] text-[#697386]">{k}</span>
                <strong className="text-[12px] text-[#172033]">{v}</strong>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
