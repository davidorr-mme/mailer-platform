import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { reportsApi } from '../../api/reports';
import { CampaignReport } from '../../types';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';

export default function ReportsPage() {
  const [reports, setReports] = useState<CampaignReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await reportsApi.getCampaignReports(page, 20);
      setReports(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-12 flex justify-center">
            <svg className="animate-spin w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-500 text-sm">No sent campaigns to report on yet</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Campaign</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Sent Date</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Recipients</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Delivered</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Open Rate</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Click Rate</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Unsub Rate</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Bounce Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/reports/campaigns/${r.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        {r.name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{r.subjectLine}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {r.sentAt ? format(new Date(r.sentAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{r.recipients.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{r.delivered.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-700">{r.openRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-teal-700">{r.clickRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{r.unsubscribeRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{r.bounceRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
