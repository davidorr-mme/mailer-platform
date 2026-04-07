import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { datamapApi } from '../../api/datamap';
import { AttributeDefinition, EventDefinition } from '../../types';
import Modal from '../../components/Modal';

type Tab = 'attributes' | 'events' | 'api';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm text-green-400 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function ApiGuideTab() {
  const [contactTab, setContactTab] = useState<'curl' | 'js'>('curl');
  const [eventTab, setEventTab] = useState<'curl' | 'js'>('curl');

  const contactCurl = `POST http://localhost:3001/api/contacts
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "email": "user@example.com",
  "attributes": {
    "test_credit_score": 750,
    "test_credit_score_type": "Equifax"
  }
}`;

  const contactJs = `fetch('http://localhost:3001/api/contacts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    attributes: {
      test_credit_score: 750,
      test_credit_score_type: 'Equifax'
    }
  })
})`;

  const eventCurl = `POST http://localhost:3001/api/contacts/:contactId/events
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "eventName": "test_credit_score_changed",
  "occurredAt": "2024-01-15T10:30:00Z",
  "metadata": {
    "new_score": 780,
    "previous_score": 620
  }
}`;

  const eventJs = `fetch('http://localhost:3001/api/contacts/:contactId/events', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    eventName: 'test_credit_score_changed',
    occurredAt: new Date().toISOString(),
    metadata: { new_score: 780, previous_score: 620 }
  })
})`;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Ingest contact with custom attributes</h3>
        <p className="text-sm text-gray-500 mb-4">Create a new contact or update an existing one by email address.</p>
        <div className="flex gap-2 mb-3">
          {(['curl', 'js'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setContactTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                contactTab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'curl' ? 'cURL' : 'JavaScript'}
            </button>
          ))}
        </div>
        <CodeBlock code={contactTab === 'curl' ? contactCurl : contactJs} language={contactTab === 'curl' ? 'bash' : 'javascript'} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Track a custom event</h3>
        <p className="text-sm text-gray-500 mb-4">Append an event record to a contact's history.</p>
        <div className="flex gap-2 mb-3">
          {(['curl', 'js'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setEventTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                eventTab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'curl' ? 'cURL' : 'JavaScript'}
            </button>
          ))}
        </div>
        <CodeBlock code={eventTab === 'curl' ? eventCurl : eventJs} language={eventTab === 'curl' ? 'bash' : 'javascript'} />
      </div>
    </div>
  );
}

interface AttrForm { name: string; dataType: 'text' | 'number' | 'boolean'; }
interface EventForm { name: string; description: string; }

export default function DataMap() {
  const [tab, setTab] = useState<Tab>('attributes');
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [events, setEvents] = useState<EventDefinition[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<AttributeDefinition | null>(null);
  const [deleteAttrId, setDeleteAttrId] = useState<string | null>(null);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDefinition | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

  const attrForm = useForm<AttrForm>({ defaultValues: { name: '', dataType: 'text' } });
  const eventForm = useForm<EventForm>({ defaultValues: { name: '', description: '' } });

  const fetchAttributes = async () => {
    setLoadingAttrs(true);
    try {
      const data = await datamapApi.getAttributes();
      setAttributes(data);
    } catch {
      toast.error('Failed to load attributes');
    } finally {
      setLoadingAttrs(false);
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await datamapApi.getEvents();
      setEvents(data);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (tab === 'attributes') fetchAttributes();
    if (tab === 'events') fetchEvents();
  }, [tab]);

  const openAttrModal = (attr?: AttributeDefinition) => {
    setEditingAttr(attr || null);
    attrForm.reset(attr ? { name: attr.name, dataType: attr.dataType } : { name: '', dataType: 'text' });
    setAttrModalOpen(true);
  };

  const submitAttr = async (data: AttrForm) => {
    try {
      if (editingAttr) {
        await datamapApi.updateAttribute(editingAttr.id, data.name);
        toast.success('Attribute updated');
      } else {
        await datamapApi.createAttribute(data.name, data.dataType);
        toast.success('Attribute created');
      }
      setAttrModalOpen(false);
      fetchAttributes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save attribute');
    }
  };

  const deleteAttr = async (id: string) => {
    try {
      await datamapApi.deleteAttribute(id);
      toast.success('Attribute deleted');
      setDeleteAttrId(null);
      fetchAttributes();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error('Cannot delete: attribute is in use by segments or campaigns');
      } else {
        toast.error('Failed to delete attribute');
      }
      setDeleteAttrId(null);
    }
  };

  const openEventModal = (ev?: EventDefinition) => {
    setEditingEvent(ev || null);
    eventForm.reset(ev ? { name: ev.name, description: ev.description } : { name: '', description: '' });
    setEventModalOpen(true);
  };

  const submitEvent = async (data: EventForm) => {
    try {
      if (editingEvent) {
        await datamapApi.updateEvent(editingEvent.id, data.name, data.description);
        toast.success('Event updated');
      } else {
        await datamapApi.createEvent(data.name, data.description);
        toast.success('Event created');
      }
      setEventModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save event');
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await datamapApi.deleteEvent(id);
      toast.success('Event deleted');
      setDeleteEventId(null);
      fetchEvents();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error('Cannot delete: event is in use by segments or automations');
      } else {
        toast.error('Failed to delete event');
      }
      setDeleteEventId(null);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'attributes', label: 'Custom Attributes' },
    { key: 'events', label: 'Custom Events' },
    { key: 'api', label: 'API Guide' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Map</h1>
        {tab === 'attributes' && (
          <button
            onClick={() => openAttrModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            Add Attribute
          </button>
        )}
        {tab === 'events' && (
          <button
            onClick={() => openEventModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            Add Event
          </button>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'attributes' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loadingAttrs ? (
            <div className="p-12 flex justify-center">
              <svg className="animate-spin w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : attributes.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-sm">No custom attributes defined yet</p>
              <button onClick={() => openAttrModal()} className="mt-3 text-indigo-600 text-sm hover:text-indigo-700 font-medium">
                Add your first attribute
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Data Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Date Created</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attributes.map((attr) => (
                  <tr key={attr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{attr.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 font-medium">
                        {attr.dataType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(attr.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openAttrModal(attr)}
                        className="text-sm text-indigo-600 hover:text-indigo-700 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteAttrId(attr.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'events' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loadingEvents ? (
            <div className="p-12 flex justify-center">
              <svg className="animate-spin w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-sm">No custom events defined yet</p>
              <button onClick={() => openEventModal()} className="mt-3 text-indigo-600 text-sm hover:text-indigo-700 font-medium">
                Add your first event
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Description</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Date Created</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ev.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{ev.description || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(ev.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEventModal(ev)}
                        className="text-sm text-indigo-600 hover:text-indigo-700 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteEventId(ev.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'api' && <ApiGuideTab />}

      {/* Attribute Modal */}
      <Modal
        isOpen={attrModalOpen}
        onClose={() => setAttrModalOpen(false)}
        title={editingAttr ? 'Edit Attribute' : 'Add Attribute'}
        size="sm"
      >
        <form onSubmit={attrForm.handleSubmit(submitAttr)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              {...attrForm.register('name', { required: 'Name is required' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. credit_score"
            />
            {attrForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{attrForm.formState.errors.name.message}</p>
            )}
          </div>
          {!editingAttr && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Type</label>
              <select
                {...attrForm.register('dataType')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAttrModalOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
            >
              {editingAttr ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Attribute Confirmation */}
      <Modal
        isOpen={!!deleteAttrId}
        onClose={() => setDeleteAttrId(null)}
        title="Delete Attribute"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this attribute? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteAttrId(null)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteAttrId && deleteAttr(deleteAttrId)}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Event Modal */}
      <Modal
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        title={editingEvent ? 'Edit Event' : 'Add Event'}
        size="sm"
      >
        <form onSubmit={eventForm.handleSubmit(submitEvent)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              {...eventForm.register('name', { required: 'Name is required' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. page_viewed"
            />
            {eventForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{eventForm.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...eventForm.register('description')}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEventModalOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
            >
              {editingEvent ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Event Confirmation */}
      <Modal
        isOpen={!!deleteEventId}
        onClose={() => setDeleteEventId(null)}
        title="Delete Event"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this event definition? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteEventId(null)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteEventId && deleteEvent(deleteEventId)}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
