import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// data = { total, completed, remaining, days: [{ date, ideal, remaining }] } from /api/scrum/sprints/:id/burndown
export default function BurndownChart({ data }) {
  const rows = data.days.map((d) => ({ day: d.date.slice(5), 'Ideal remaining': d.ideal, 'Actual remaining': d.remaining }));
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Sprint timeline: {data.days[0]?.date} to {data.days[data.days.length - 1]?.date}</p>
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-slate-600">
        <p>Total story points: <b className="text-slate-900">{data.total}</b></p>
        <p>Completed: <b className="text-emerald-700">{data.completed}</b></p>
        <p>Remaining: <b className="text-amber-700">{data.remaining}</b></p>
      </div>
      {data.total === 0 ? <p className="text-slate-400">This sprint has no tasks yet, so there is nothing to burn down.</p> : (
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} domain={[0, Math.max(data.total, 1)]} tick={{ fontSize: 12 }} label={{ value: 'Story points', angle: -90, position: 'insideLeft', fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Ideal remaining" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="Actual remaining" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
