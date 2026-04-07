import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { segmentsApi } from '../../api/segments';
import { datamapApi } from '../../api/datamap';
import { AttributeDefinition, EventDefinition, Condition, ConditionGroup, SegmentLogic } from '../../types';

type FieldMeta = {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'event';
  label: string;
  category: 'attribute' | 'event';
};

function getOperatorsForType(type: string): { value: string; label: string }[] {
  switch (type) {
    case 'text':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'not_contains', label: 'Does not contain' },
        { value: 'is_set', label: 'Is set' },
        { value: 'is_not_set', label: 'Is not set' },
      ];
    case 'number':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not equals' },
        { value: 'greater_than', label: 'Greater than' },
        { value: 'less_than', label: 'Less than' },
        { value: 'between', label: 'Between' },
        { value: 'is_set', label: 'Is set' },
        { value: 'is_not_set', label: 'Is not set' },
      ];
    case 'boolean':
      return [
        { value: 'is_true', label: 'Is true' },
        { value: 'is_false', label: 'Is false' },
        { value: 'is_set', label: 'Is set' },
        { value: 'is_not_set', label: 'Is not set' },
      ];
    case 'event':
      return [
        { value: 'has_occurred', label: 'Has occurred' },
        { value: 'has_not_occurred', label: 'Has not occurred' },
        { value: 'occurred_more_than', label: 'Occurred more than' },
        { value: 'occurred_exactly', label: 'Occurred exactly' },
        { value: 'occurred_at_least', label: 'Occurred at least' },
      ];
    default:
      return [{ value: 'equals', label: 'Equals' }];
  }
}

function needsValue(operator: string, type: string): boolean {
  if (['is_set', 'is_not_set', 'is_true', 'is_false', 'has_occurred', 'has_not_occurred'].includes(operator)) return false;
  return true;
}

function needsDateRange(operator: string): boolean {
  return ['has_occurred', 'has_not_occurred', 'occurred_more_than', 'occurred_exactly', 'occurred_at_least'].includes(operator);
}

interface ConditionRowProps {
  condition: Condition;
  fields: FieldMeta[];
  onChange: (cond: Condition) => void;
  onRemove: () => void;
}

function ConditionRow({ condition, fields, onChange, onRemove }: ConditionRowProps) {
  const selectedField = fields.find(f => f.name === condition.field);
  const operators = selectedField ? getOperatorsForType(selectedField.type) : [];

  const handleFieldChange = (fieldName: string) => {
    const f = fields.find(f => f.name === fieldName);
    const ops = f ? getOperatorsForType(f.type) : [];
    onChange({ ...condition, field: fieldName, type: f?.category || 'attribute', operator: ops[0]?.value || '', value: undefined, dateRange: undefined });
  };

  const handleOperatorChange = (op: string) => {
    onChange({ ...condition, operator: op, value: undefined, dateRange: undefined });
  };

  const showDateRange = needsDateRange(condition.operator) && selectedField?.type === 'event';
  const showValue = needsValue(condition.operator, selectedField?.type || '') && !showDateRange;
  const isBetween = condition.operator === 'between';

  return (
    <div className="flex items-start gap-2 flex-wrap">
      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-40"
      >
        <option value="">Select field...</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            [{f.category === 'event' ? 'Event' : 'Attr'}] {f.label}
          </option>
        ))}
      </select>

      {condition.field && (
        <select
          value={condition.operator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      )}

      {showValue && !isBetween && selectedField?.type === 'boolean' && (
        <select
          value={condition.value ?? ''}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      )}

      {showValue && !isBetween && selectedField?.type === 'number' && (
        <input
          type="number"
          value={condition.value ?? ''}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-28"
          placeholder="Value"
        />
      )}

      {showValue && !isBetween && selectedField?.type === 'text' && (
        <input
          type="text"
          value={condition.value ?? ''}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
          placeholder="Value"
        />
      )}

      {isBetween && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={condition.value?.min ?? ''}
            onChange={(e) => onChange({ ...condition, value: { ...condition.value, min: e.target.value } })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
            placeholder="Min"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="number"
            value={condition.value?.max ?? ''}
            onChange={(e) => onChange({ ...condition, value: { ...condition.value, max: e.target.value } })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
            placeholder="Max"
          />
        </div>
      )}

      {showDateRange && (
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500">in the</span>
          <input
            type="number"
            value={condition.dateRange?.value ?? 30}
            onChange={(e) => onChange({ ...condition, dateRange: { ...condition.dateRange as any, value: Number(e.target.value) } })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={condition.dateRange?.unit ?? 'days'}
            onChange={(e) => onChange({ ...condition, dateRange: { ...condition.dateRange as any, unit: e.target.value as any } })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
          <select
            value={condition.dateRange?.direction ?? 'last'}
            onChange={(e) => onChange({ ...condition, dateRange: { ...condition.dateRange as any, direction: e.target.value as any } })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="last">Last</option>
            <option value="next">Next</option>
          </select>
        </div>
      )}

      <button onClick={onRemove} className="text-gray-400 hover:text-red-500 mt-1.5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface GroupCardProps {
  group: ConditionGroup;
  groupIndex: number;
  fields: FieldMeta[];
  canRemove: boolean;
  onChange: (g: ConditionGroup) => void;
  onRemove: () => void;
}

function GroupCard({ group, groupIndex, fields, canRemove, onChange, onRemove }: GroupCardProps) {
  const addCondition = () => {
    const defaultField = fields[0];
    const newCond: Condition = {
      type: defaultField?.category || 'attribute',
      field: defaultField?.name || '',
      operator: defaultField ? getOperatorsForType(defaultField.type)[0]?.value : 'equals',
    };
    onChange({ ...group, conditions: [...group.conditions, newCond] });
  };

  const updateCondition = (idx: number, cond: Condition) => {
    const updated = [...group.conditions];
    updated[idx] = cond;
    onChange({ ...group, conditions: updated });
  };

  const removeCondition = (idx: number) => {
    onChange({ ...group, conditions: group.conditions.filter((_, i) => i !== idx) });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Match</span>
        <div className="flex rounded-md overflow-hidden border border-gray-200">
          {(['AND', 'OR'] as const).map((op) => (
            <button
              key={op}
              onClick={() => onChange({ ...group, operator: op })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                group.operator === op ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">of the following</span>
      </div>

      <div className="space-y-2">
        {group.conditions.map((cond, idx) => (
          <ConditionRow
            key={idx}
            condition={cond}
            fields={fields}
            onChange={(c) => updateCondition(idx, c)}
            onRemove={() => removeCondition(idx)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={addCondition}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Condition
        </button>
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Remove Group
          </button>
        )}
      </div>
    </div>
  );
}

interface HeaderForm {
  name: string;
  description: string;
}

export default function SegmentBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const { register, handleSubmit, formState: { errors } } = useForm<HeaderForm>();
  const [nameValue, setNameValue] = useState('');
  const [descValue, setDescValue] = useState('');

  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [logic, setLogic] = useState<SegmentLogic>({
    operator: 'AND',
    groups: [{ operator: 'AND', conditions: [] }],
  });
  const [estimateCount, setEstimateCount] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadFields = async () => {
      try {
        const [attrs, events] = await Promise.all([
          datamapApi.getAttributes(),
          datamapApi.getEvents(),
        ]);
        const attrFields: FieldMeta[] = attrs.map((a: AttributeDefinition) => ({
          name: a.name,
          type: a.dataType,
          label: a.name,
          category: 'attribute',
        }));
        const eventFields: FieldMeta[] = events.map((e: EventDefinition) => ({
          name: e.name,
          type: 'event' as const,
          label: e.name,
          category: 'event',
        }));
        setFields([...attrFields, ...eventFields]);
      } catch {
        toast.error('Failed to load fields');
      }
    };

    const loadSegment = async () => {
      if (!id) return;
      try {
        const seg = await segmentsApi.getSegment(id);
        setNameValue(seg.name);
        setDescValue(seg.description);
        setLogic(seg.logic);
      } catch {
        toast.error('Failed to load segment');
      }
    };

    loadFields();
    loadSegment();
  }, [id]);

  const handleEstimate = async () => {
    setEstimating(true);
    try {
      const result = await segmentsApi.estimateSegment(logic);
      setEstimateCount(result.count);
    } catch {
      toast.error('Estimation failed');
    } finally {
      setEstimating(false);
    }
  };

  const handleSave = async () => {
    if (!nameValue.trim()) {
      toast.error('Segment name is required');
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await segmentsApi.updateSegment(id, { name: nameValue, description: descValue, logic });
        toast.success('Segment updated');
      } else {
        await segmentsApi.createSegment({ name: nameValue, description: descValue, logic });
        toast.success('Segment created');
      }
      navigate('/audience');
    } catch {
      toast.error('Failed to save segment');
    } finally {
      setSaving(false);
    }
  };

  const addGroup = () => {
    setLogic({
      ...logic,
      groups: [...logic.groups, { operator: 'AND', conditions: [] }],
    });
  };

  const updateGroup = (idx: number, group: ConditionGroup) => {
    const updated = [...logic.groups];
    updated[idx] = group;
    setLogic({ ...logic, groups: updated });
  };

  const removeGroup = (idx: number) => {
    setLogic({ ...logic, groups: logic.groups.filter((_, i) => i !== idx) });
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Edit Segment' : 'Create Segment'}
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segment Name *</label>
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. High-value customers"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional description"
            />
          </div>
        </div>
      </div>

      {/* Top-level operator */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-gray-600">Match</span>
        <div className="flex rounded-md overflow-hidden border border-gray-200">
          {(['AND', 'OR'] as const).map((op) => (
            <button
              key={op}
              onClick={() => setLogic({ ...logic, operator: op })}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                logic.operator === op ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-600">of the following groups</span>
      </div>

      <div className="space-y-4">
        {logic.groups.map((group, idx) => (
          <div key={idx}>
            {idx > 0 && (
              <div className="flex justify-center my-2">
                <span className="px-4 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                  {logic.operator}
                </span>
              </div>
            )}
            <GroupCard
              group={group}
              groupIndex={idx}
              fields={fields}
              canRemove={logic.groups.length > 1}
              onChange={(g) => updateGroup(idx, g)}
              onRemove={() => removeGroup(idx)}
            />
          </div>
        ))}
      </div>

      <button
        onClick={addGroup}
        className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Group
      </button>

      {/* Bottom actions */}
      <div className="mt-6 pt-5 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleEstimate}
            disabled={estimating}
            className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60 transition-colors"
          >
            {estimating ? 'Estimating...' : 'Estimate Audience'}
          </button>
          {estimateCount !== null && (
            <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-md">
              ~{estimateCount.toLocaleString()} contacts
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/audience')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-60"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Segment' : 'Create Segment'}
          </button>
        </div>
      </div>
    </div>
  );
}
