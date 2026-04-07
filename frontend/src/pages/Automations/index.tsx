import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { automationsApi } from '../../api/automations';
import { datamapApi } from '../../api/datamap';
import { segmentsApi } from '../../api/segments';
import { Automation, EventDefinition, AttributeDefinition, Segment } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';

interface CreateForm {
  name: string;
  triggerType: 'event_occurred' | 'attribute_change';
  triggerEvent: string;
  triggerAttribute: string;
  triggerAttributeChange: 'any' | 'to_value';
  triggerAttributeValue: string;
  reEnrollment: 'allow' | 'deny';
  targetSegmentId: string;
}

function CreateAutomationModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [eventDefs, setEventDefs] = useState<EventDefinition[]>([]);
  const [attrDefs, setAttrDefs] = useState<AttributeDefinition[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [exitCriteria, setExitCriteria] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CreateForm>({
    defaultValues: {
      triggerType: 'event_occurred',
      triggerAttributeChange: 'any',
      reEnrollment: 'deny',
    },
  });

  const triggerType = watch('triggerType');

  useEffect(() => {
    if (isOpen) {
      datamapApi.getEvents().then(setEventDefs).catch(() => {});
      datamapApi.getAttributes().then(setAttrDefs).catch(() => {});
      segmentsApi.getSegments(1, 100).then((d) => setSegments(d.items)).catch(() => {});
    }
  }, [isOpen]);

  const addExitCriterion = () => {
    setExitCriteria([...exitCriteria, { type: 'contact_unsubscribed', segmentId: '' }]);
  };

  const removeExitCriterion = (idx: number) => {
    setExitCriteria(exitCriteria.filter((_, i) => i !== idx));
  };

  const updateExitCriterion = (idx: number, updates: any) => {
    const updated = [...exitCriteria];
    updated[idx] = { ...updated[idx], ...updates };
    setExitCriteria(updated);
  };

  const onSubmit = async (data: CreateForm) => {
    setSubmitting(true);
    try {
      let entryCriteria: any = { type: data.triggerType };
      if (data.triggerType === 'event_occurred') {
        entryCriteria.eventName = data.triggerEvent;
      } else {
        entryCriteria.attributeName = data.triggerAttribute;
        entryCriteria.changeType = data.triggerAttributeChange;
        if (data.triggerAttributeChange === 'to_value') {
          entryCriteria.value = data.triggerAttributeValue;
        }
      }
      entryCriteria.reEnrollment = data.reEnrollment;

      const automation = await automationsApi.createAutomation({
        name: data.name,
        status: 'draft',
        entryCriteria,
        exitCriteria,
        targetSegmentId: data.targetSegmentId || null,
        workflowJson: { nodes: [], edges: [] },
      });
      toast.success('Automation created');
      onCreated(automation.id);
    } catch {
      toast.error('Failed to create automation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Automation" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Automation Name *</label>
          <input
            {...register('name', { required: 'Name is required' })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Welcome Series"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Entry Criteria</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trigger Type</label>
              <select
                {...register('triggerType')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="event_occurred">Event Occurred</option>
                <option value="attribute_change">Attribute Change</option>
              </select>
            </div>

            {triggerType === 'event_occurred' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Event</label>
                <select
                  {...register('triggerEvent')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select event...</option>
                  {eventDefs.map((e) => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {triggerType === 'attribute_change' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Attribute</label>
                  <select
                    {...register('triggerAttribute')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select attribute...</option>
                    {attrDefs.map((a) => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Change Condition</label>
                  <select
                    {...register('triggerAttributeChange')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="any">Any change</option>
                    <option value="to_value">Changes to specific value</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Re-enrollment</label>
              <div className="flex gap-4">
                {['allow', 'deny'].map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm">
                    <input type="radio" {...register('reEnrollment')} value={v} className="text-indigo-600" />
                    <span className="capitalize">{v}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Segment (optional)</label>
          <select
            {...register('targetSegmentId')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All contacts</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">Only enroll contacts in this segment (optional)</p>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Exit Criteria</h4>
            <button type="button" onClick={addExitCriterion} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              + Add Condition
            </button>
          </div>
          {exitCriteria.length === 0 ? (
            <p className="text-xs text-gray-400">No exit criteria (contacts complete when workflow ends)</p>
          ) : (
            <div className="space-y-2">
              {exitCriteria.map((ec, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={ec.type}
                    onChange={(e) => updateExitCriterion(idx, { type: e.target.value })}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="contact_unsubscribed">Contact unsubscribes</option>
                    <option value="segment_membership">Segment membership change</option>
                  </select>
                  {ec.type === 'segment_membership' && (
                    <select
                      value={ec.segmentId || ''}
                      onChange={(e) => updateExitCriterion(idx, { segmentId: e.target.value })}
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Select segment...</option>
                      {segments.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => removeExitCriterion(idx)} className="text-gray-400 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create & Open Canvas'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AutomationsPage() {
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const data = await automationsApi.getAutomations(page, 20);
      setAutomations(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAutomations(); }, [page]);

  const handleToggleStatus = async (automation: Automation) => {
    try {
      if (automation.status === 'active') {
        await automationsApi.pauseAutomation(automation.id);
        toast.success('Automation paused');
      } else {
        await automationsApi.activateAutomation(automation.id);
        toast.success('Automation activated');
      }
      fetchAutomations();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await automationsApi.duplicateAutomation(id);
      toast.success('Automation duplicated');
      fetchAutomations();
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await automationsApi.deleteAutomation(id);
      toast.success('Automation deleted');
      setDeleteId(null);
      fetchAutomations();
    } catch {
      toast.error('Failed to delete');
      setDeleteId(null);
    }
  };

  const handleCreated = (id: string) => {
    setCreateModalOpen(false);
    navigate(`/automations/${id}/canvas`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          Create Automation
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
        ) : automations.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-gray-500 text-sm">No automations yet</p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              Create your first automation
            </button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Enrolled</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Completed</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Last Modified</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {automations.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{a.enrolledCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{a.completedCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(a.updatedAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/automations/${a.id}/canvas`)}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(a)}
                        className={`text-sm ${a.status === 'active' ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'}`}
                      >
                        {a.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDuplicate(a.id)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => setDeleteId(a.id)}
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

      <CreateAutomationModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Automation" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this automation? This action cannot be undone.
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
