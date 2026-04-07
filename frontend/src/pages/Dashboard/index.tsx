import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { dashboardApi } from '../../api/dashboard';
import { DashboardKpis, PerformanceDataPoint, Campaign, Automation } from '../../types';
import StatusBadge from '../../components/StatusBadge';

const dayOptions = [
  { label: 'Last 7d', value: 7 },
  { label: 'Last 30d', value: 30 },
  { label: 'Last 90d', value: 90 },
];

function KpiCard({
  label,
  value,
  colorClass,
  icon,
}: {
  label: string;
  value: string | number;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg ${colorClass}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg col-span-1" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [chartData, setChartData] = useState<PerformanceDataPoint[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [recentAutomations, setRecentAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [kpiData, chart, campaigns, automations] = await Promise.all([
          dashboardApi.getKpis(days),
          dashboardApi.getPerformanceChart(days),
          dashboardApi.getRecentCampaigns(),
          dashboardApi.getRecentAutomations(),
        ]);
        setKpis(kpiData);
        setChartData(chart);
        setRecentCampaigns(campaigns);
        setRecentAutomations(automations);
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [days]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {dayOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                days === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            label="Total Contacts"
            value={kpis.totalContacts.toLocaleString()}
            colorClass="bg-indigo-50 text-indigo-600"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <KpiCard
            label="Active Automations"
            value={kpis.activeAutomations.toLocaleString()}
            colorClass="bg-purple-50 text-purple-600"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <KpiCard
            label="Campaigns Sent"
            value={kpis.campaignsSent.toLocaleString()}
            colorClass="bg-blue-50 text-blue-600"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          <KpiCard
            label="Avg Open Rate"
            value={`${kpis.avgOpenRate.toFixed(1)}%`}
            colorClass="bg-green-50 text-green-600"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />
          <KpiCard
            label="Avg Click Rate"
            value={`${kpis.avgClickRate.toFixed(1)}%`}
            colorClass="bg-teal-50 text-teal-600"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            }
          />
          <KpiCard
            label="Unsub Rate"
            value={`${kpis.unsubscribeRate.toFixed(1)}%`}
            colorClass="bg-red-50 text-red-600"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
              </svg>
            }
          />
        </div>
      )}

      {chartData.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Email Performance</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  try { return format(new Date(v), 'MMM d'); } catch { return v; }
                }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
              <Legend />
              <Line type="monotone" dataKey="openRate" stroke="#6366f1" strokeWidth={2} dot={false} name="Open Rate" />
              <Line type="monotone" dataKey="clickRate" stroke="#0d9488" strokeWidth={2} dot={false} name="Click Rate" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No performance data for this period</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Recent Campaigns</h3>
            <Link to="/campaigns" className="text-sm text-indigo-600 hover:text-indigo-700">View all</Link>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No campaigns yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Open %</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Click %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/reports/campaigns/${c.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {c.openRate !== undefined ? `${c.openRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {c.clickRate !== undefined ? `${c.clickRate.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Recent Automations</h3>
            <Link to="/automations" className="text-sm text-indigo-600 hover:text-indigo-700">View all</Link>
          </div>
          {recentAutomations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No automations yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Enrolled</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentAutomations.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/automations/${a.id}/canvas`} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {a.enrolledCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {a.completedCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
