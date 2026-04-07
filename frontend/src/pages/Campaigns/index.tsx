import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { campaignsApi } from '../../api/campaigns';
import { Campaign } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';

const statusTabs = ['all', 'draft', 'scheduled', 'sent'] as const;
type StatusFilter = typeof statusTabs[number];

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await campaignsApi.getCampaigns(page, 20, statusFilter === 'all' ? undefined : statusFilter);
      setCampaigns(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [page, statusFilter]);

  const handleDuplicate = async (id: string) => {
    try {
      await campaignsApi.duplicateCampaign(id);
      toast.success('Campaign duplicated');
      fetchCampaigns();
    } catch {
      toast.error('Failed to duplicate campaign');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await campaignsApi.deleteCampaign(id);
      toast.success('Campaign deleted');
      setDeleteId(null);
      fetchCampaigns();
    } catch {
      toast.error('Failed to delete campaign');
      setDeleteId(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await campaignsApi.updateCampaign(id, { status: 'cancelled' });
      toast.success('Campaign cancelled');
      fetchCampaigns();
    } catch {
      toast.error('Failed to cancel campaign');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          Create Campaign
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="border-b border-gray-200 mb-5">
        <nav className="flex gap-6">
          {statusTabs.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`pb-3 text-sm font-medium border-b-2 capitalize transition-colors ${
                statusFilter === s
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-12 flex justify-center">
            <svg className="animate-spin w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 text-sm">No campaigns found</p>
            <button
              onClick={() => navigate('/campaigns/new')}
              className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              Create your first campaign
            </button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Segment</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Sent / Scheduled</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Open %</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Click %</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.segmentName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.sentAt
                        ? format(new Date(c.sentAt), 'MMM d, yyyy')
                        : c.scheduledAt
                        ? format(new Date(c.scheduledAt), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {c.openRate !== undefined ? `${c.openRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {c.clickRate !== undefined ? `${c.clickRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <button
                          onClick={() => navigate(`/campaigns/${c.id}/edit`)}
                          className="text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(c.id)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Duplicate
                      </button>
                      {c.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancel(c.id)}
                          className="text-sm text-yellow-600 hover:text-yellow-700"
                        >
                          Cancel
                        </button>
                      )}
                      {c.status !== 'sending' && (
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Campaign" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this campaign? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => deleteId && handleDelete(deleteId)} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
