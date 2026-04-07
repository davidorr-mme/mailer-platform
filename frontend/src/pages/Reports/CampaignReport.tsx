import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
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
import { reportsApi } from '../../api/reports';
import { CampaignReport } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';

function KpiCard({ label, value, subValue }: { label: string; value: string | number; subValue?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-0.5">{subValue}</p>}
    </div>
  );
}

export default function CampaignReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [chartMode, setChartMode] = useState<'unique' | 'total'>('unique');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [r, l] = await Promise.all([
          reportsApi.getCampaignReport(id),
          reportsApi.getCampaignLinks(id),
        ]);
        setReport(r);
        setLinks(l);
      } catch {
        toast.error('Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    reportsApi.getCampaignRecipients(id, recipientsPage, 25, recipientFilter === 'all' ? undefined : recipientFilter)
      .then((data) => {
        setRecipients(data.items);
        setRecipientsTotal(data.total);
      })
      .catch(() => {});
  }, [id, recipientsPage, recipientFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!report) return null;

  const chartData = report.engagementOverTime || [];

  const recipientFilterTabs = ['all', 'opened', 'not_opened', 'clicked', 'unsubscribed', 'bounced'];

  const CheckIcon = ({ value }: { value: boolean }) => (
    <span className={value ? 'text-green-500' : 'text-gray-300'}>
      {value ? '✓' : '✗'}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{report.name}</h1>
          <StatusBadge status={report.status} />
        </div>
        <p className="text-sm text-gray-500">{report.subjectLine}</p>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
          <span>Segment: <span className="text-gray-600 font-medium">{report.segmentName || '—'}</span></span>
          <span>•</span>
          <span>Sent: <span className="text-gray-600 font-medium">{report.sentAt ? format(new Date(report.sentAt), 'MMM d, yyyy HH:mm') : '—'}</span></span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Recipients" value={report.recipients.toLocaleString()} />
        <KpiCard label="Delivered" value={report.delivered.toLocaleString()} subValue={`${report.deliveryRate.toFixed(1)}% delivery rate`} />
        <KpiCard label="Unique Opens" value={report.opensUnique.toLocaleString()} subValue={`${report.openRate.toFixed(1)}% open rate`} />
        <KpiCard label="Unique Clicks" value={report.clicksUnique.toLocaleString()} subValue={`${report.clickRate.toFixed(1)}% click rate`} />
        <KpiCard label="CTOR" value={`${report.ctor.toFixed(1)}%`} subValue="Click-to-open rate" />
        <KpiCard label="Unsubscribes" value={report.unsubscribes.toLocaleString()} subValue={`${report.unsubscribeRate.toFixed(1)}% unsub rate`} />
        <KpiCard label="Bounces" value={report.bounces.toLocaleString()} subValue={`${report.bounceRate.toFixed(1)}% bounce rate`} />
        <KpiCard label="Spam Complaints" value={report.spamComplaints.toLocaleString()} />
      </div>

      {/* Engagement Over Time */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Engagement Over Time</h3>
          <div className="flex gap-1">
            {(['unique', 'total'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  chartMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No engagement data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v) => {
                  try { return format(new Date(v), 'MMM d HH:mm'); } catch { return v; }
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(v) => {
                  try { return format(new Date(v), 'MMM d, yyyy HH:mm'); } catch { return v; }
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="opens" stroke="#6366f1" strokeWidth={2} dot={false} name="Opens" />
              <Line type="monotone" dataKey="clicks" stroke="#0d9488" strokeWidth={2} dot={false} name="Clicks" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Link Click Breakdown */}
      {links.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Link Click Breakdown</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">URL</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Total Clicks</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Unique Clicks</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">% of Openers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((link, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-700 truncate block max-w-sm"
                      title={link.url}
                    >
                      {link.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{link.totalClicks.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{link.uniqueClicks.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{link.pctOpeners.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recipient Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Recipient Activity</h3>
          <div className="flex flex-wrap gap-1">
            {recipientFilterTabs.map((f) => (
              <button
                key={f}
                onClick={() => { setRecipientFilter(f); setRecipientsPage(1); }}
                className={`px-3 py-1 text-xs font-medium rounded-full capitalize transition-colors ${
                  recipientFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        {recipients.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No recipients found</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Email</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Delivered</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Opened</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Clicked</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Unsubscribed</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Bounced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recipients.map((r: any) => (
                  <tr key={r.id || r.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/audience?lookup=${encodeURIComponent(r.email)}`}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        {r.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center"><CheckIcon value={r.delivered} /></td>
                    <td className="px-4 py-3 text-center"><CheckIcon value={r.opened} /></td>
                    <td className="px-4 py-3 text-center"><CheckIcon value={r.clicked} /></td>
                    <td className="px-4 py-3 text-center"><CheckIcon value={r.unsubscribed} /></td>
                    <td className="px-4 py-3 text-center"><CheckIcon value={r.bounced} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={recipientsPage} pageSize={25} total={recipientsTotal} onChange={setRecipientsPage} />
          </>
        )}
      </div>
    </div>
  );
}
