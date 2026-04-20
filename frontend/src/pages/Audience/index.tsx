import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { segmentsApi } from '../../api/segments';
import { contactsApi } from '../../api/contacts';
import { datamapApi } from '../../api/datamap';
import { Segment, Contact, CustomEvent, AttributeDefinition, PaginatedResponse } from '../../types';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';

type Tab = 'segments' | 'lookup';

function SegmentList() {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const data = await segmentsApi.getSegments(page, 20);
      setSegments(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSegments(); }, [page]);

  const handleDuplicate = async (id: string) => {
    try {
      await segmentsApi.duplicateSegment(id);
      toast.success('Segment duplicated');
      fetchSegments();
    } catch {
      toast.error('Failed to duplicate segment');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await segmentsApi.deleteSegment(id);
      toast.success('Segment deleted');
      setDeleteId(null);
      fetchSegments();
    } catch {
      toast.error('Failed to delete segment');
      setDeleteId(null);
    }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      await segmentsApi.exportSegment(id, name);
      toast.success('Export downloaded');
    } catch {
      toast.error('Failed to export segment');
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => navigate('/audience/segments/new')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          Create Segment
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-12 flex justify-center">
            <svg className="animate-spin w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : segments.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 text-sm">No segments yet</p>
            <button
              onClick={() => navigate('/audience/segments/new')}
              className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              Create your first segment
            </button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Description</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Contacts</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Last Updated</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {segments.map((seg) => (
                  <tr key={seg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{seg.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{seg.description || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 font-medium">
                      {seg.contactCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(seg.updatedAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/audience/segments/${seg.id}/edit`)}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(seg.id)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleExport(seg.id, seg.name)}
                        className="text-sm text-green-600 hover:text-green-700"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => setDeleteId(seg.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Segment" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this segment? This action cannot be undone.
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

function ExpandableMetadata({ metadata }: { metadata: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="text-xs text-indigo-600 hover:text-indigo-700">
        {expanded ? 'Hide' : 'Show'} metadata
      </button>
      {expanded && (
        <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ExpandableCampaignRow({ send }: { send: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-900">{send.campaignName || send.campaignId}</td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {send.sentAt ? format(new Date(send.sentAt), 'MMM d, yyyy') : '—'}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={send.status} />
        </td>
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-indigo-600 hover:text-indigo-700">
            {expanded ? 'Hide' : 'View'} events
          </button>
        </td>
      </tr>
      {expanded && send.engagementEvents && send.engagementEvents.length > 0 && (
        <tr>
          <td colSpan={4} className="px-4 pb-3">
            <div className="bg-gray-50 rounded p-3 space-y-1">
              {send.engagementEvents.map((ev: any) => (
                <div key={ev.id} className="text-xs text-gray-600 flex gap-3">
                  <span className="font-medium capitalize">{ev.type}</span>
                  {ev.url && <span className="text-indigo-600 truncate max-w-xs">{ev.url}</span>}
                  <span className="text-gray-400">{format(new Date(ev.occurredAt), 'MMM d, HH:mm')}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function UserLookup() {
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [contact, setContact] = useState<Contact | null | undefined>(undefined);
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editUnsubscribe, setEditUnsubscribe] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSearch = async () => {
    if (!email.trim()) return;
    setSearching(true);
    try {
      const result = await contactsApi.searchContact(email.trim());
      setContact(result);
      if (result) {
        const [evData, campData, attrData] = await Promise.all([
          contactsApi.getContactEvents(result.id, 1, 25),
          contactsApi.getContactCampaignHistory(result.id),
          datamapApi.getAttributes(),
        ]);
        setEvents(evData.items);
        setEventsTotal(evData.total);
        setCampaignHistory(campData);
        setAttributes(attrData);
        setEventsPage(1);
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleStartEdit = () => {
    if (!contact) return;
    setEditEmail(contact.email);
    setEditUnsubscribe(contact.globalUnsubscribe);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      const updated = await contactsApi.updateContact(contact.id, {
        email: editEmail,
        globalUnsubscribe: editUnsubscribe,
      });
      setContact({ ...contact, ...updated, email: updated.email ?? editEmail, globalUnsubscribe: updated.globalUnsubscribe ?? editUnsubscribe });
      setEditing(false);
      toast.success('Contact updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const loadMoreEvents = async (p: number) => {
    if (!contact) return;
    try {
      const data = await contactsApi.getContactEvents(contact.id, p, 25);
      setEvents(data.items);
      setEventsPage(p);
    } catch {
      toast.error('Failed to load events');
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex gap-3 mb-6">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter contact email address..."
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {contact === null && (
        <div className="text-center py-12 text-gray-500">
          No contact found for <span className="font-medium">{email}</span>
        </div>
      )}

      {contact && (
        <div className="space-y-6">
          {/* Identity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Identity</h3>
              <div className="flex items-center gap-3">
                {contact.globalUnsubscribe && !editing && (
                  <span className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    Globally Unsubscribed
                  </span>
                )}
                {!editing ? (
                  <button
                    onClick={handleStartEdit}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-md disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {editing ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Contact ID</label>
                  <p className="text-sm text-gray-400">{contact.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editUnsubscribe"
                    checked={editUnsubscribe}
                    onChange={(e) => setEditUnsubscribe(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="editUnsubscribe" className="text-sm text-gray-700">
                    Globally Unsubscribed
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-2 gap-4">
                {[
                  { label: 'Email', value: contact.email },
                  { label: 'Contact ID', value: contact.id },
                  { label: 'Created', value: format(new Date(contact.createdAt), 'MMM d, yyyy HH:mm') },
                  { label: 'Updated', value: format(new Date(contact.updatedAt), 'MMM d, yyyy HH:mm') },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-sm text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Attributes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Custom Attributes</h3>
            </div>
            {attributes.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">No custom attributes defined</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Attribute</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attributes.map((attr) => (
                    <tr key={attr.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{attr.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{attr.dataType}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(() => {
                          const attrs = contact.customAttributes ?? (contact as any).custom_attributes ?? {};
                          return attrs[attr.name] !== undefined ? String(attrs[attr.name]) : '—';
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Custom Events */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Custom Events</h3>
            </div>
            {events.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">No events recorded</p>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Event Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Occurred At</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{ev.eventName}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {format(new Date(ev.occurredAt), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          {Object.keys(ev.metadata || {}).length > 0 ? (
                            <ExpandableMetadata metadata={ev.metadata} />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={eventsPage} pageSize={25} total={eventsTotal} onChange={loadMoreEvents} />
              </>
            )}
          </div>

          {/* Campaign History */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Campaign History</h3>
            </div>
            {campaignHistory.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">No campaign history</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Campaign</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Sent At</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Engagement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaignHistory.map((send) => (
                    <ExpandableCampaignRow key={send.id} send={send} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Audience() {
  const [tab, setTab] = useState<Tab>('segments');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audience</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {([['segments', 'Segments'], ['lookup', 'User Lookup']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'segments' && <SegmentList />}
      {tab === 'lookup' && <UserLookup />}
    </div>
  );
}
