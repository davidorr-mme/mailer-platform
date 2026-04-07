import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Controls,
  Background,
  Handle,
  Position,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import toast from 'react-hot-toast';
import { automationsApi } from '../../api/automations';
import { Automation } from '../../types';
import StatusBadge from '../../components/StatusBadge';

function generateId() {
  return `node_${Math.random().toString(36).substr(2, 9)}`;
}

// Custom node: Email Action
function EmailActionNode({ data, selected }: { data: any; selected?: boolean; [key: string]: any }) {
  return (
    <div className={`bg-white border-2 rounded-lg shadow-sm w-48 ${selected ? 'border-indigo-500' : 'border-gray-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-indigo-400" />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-700">Send Email</span>
        </div>
        <p className="text-xs text-gray-500 truncate">{(data as any).emailName || 'Configure email'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400" />
    </div>
  );
}

// Custom node: Delay
function DelayNode({ data, selected }: { data: any; selected?: boolean; [key: string]: any }) {
  const d = data as any;
  const durationStr = d.duration ? `Wait ${d.duration} ${d.unit || 'days'}` : 'Configure delay';
  return (
    <div className={`bg-white border-2 rounded-lg shadow-sm w-40 ${selected ? 'border-indigo-500' : 'border-gray-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 bg-yellow-100 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-700">Delay</span>
        </div>
        <p className="text-xs text-gray-500">{durationStr}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400" />
    </div>
  );
}

// Custom node: A/B Test
function ABTestNode({ data, selected }: { data: any; selected?: boolean; [key: string]: any }) {
  const d = data as any;
  const aStr = d.splitA ? `A: ${d.splitA}%` : 'A: 50%';
  const bStr = d.splitB ? `B: ${d.splitB}%` : 'B: 50%';
  return (
    <div className={`bg-white border-2 rounded-lg shadow-sm w-44 ${selected ? 'border-indigo-500' : 'border-gray-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-400" />
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-700">A/B Test</span>
        </div>
        <p className="text-xs text-gray-500">{aStr} / {bStr}</p>
      </div>
      <Handle type="source" position={Position.Bottom} id="a" style={{ left: '30%' }} className="!bg-purple-400" />
      <Handle type="source" position={Position.Bottom} id="b" style={{ left: '70%' }} className="!bg-purple-400" />
    </div>
  );
}

// Custom node: Audience Path
function AudiencePathNode({ data, selected }: { data: any; selected?: boolean; [key: string]: any }) {
  const d = data as any;
  return (
    <div className={`bg-white border-2 rounded-lg shadow-sm w-44 ${selected ? 'border-indigo-500' : 'border-gray-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-teal-400" />
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 bg-teal-100 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v9a6 6 0 006 6 6 6 0 006-6V3M6 3h4m4 0h4" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-700">Audience Path</span>
        </div>
        <p className="text-xs text-gray-500 truncate">{d.conditionLabel || 'Configure condition'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="!bg-green-400" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="!bg-red-400" />
    </div>
  );
}

const nodeTypes = {
  emailAction: EmailActionNode,
  delay: DelayNode,
  abTest: ABTestNode,
  audiencePath: AudiencePathNode,
};

const paletteNodes = [
  { type: 'emailAction', label: 'Email Action', icon: '✉', color: 'indigo' },
  { type: 'delay', label: 'Delay', icon: '⏱', color: 'yellow' },
  { type: 'abTest', label: 'A/B Test', icon: '⇆', color: 'purple' },
  { type: 'audiencePath', label: 'Audience Path', icon: '⑂', color: 'teal' },
];

interface NodeSettingsProps {
  node: Node;
  onUpdate: (data: any) => void;
}

function NodeSettings({ node, onUpdate }: NodeSettingsProps) {
  const d = node.data as any;

  switch (node.type) {
    case 'emailAction':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Email Name</label>
            <input
              type="text"
              value={d.emailName || ''}
              onChange={(e) => onUpdate({ ...d, emailName: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Welcome Email"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Subject Line</label>
            <input
              type="text"
              value={d.subjectLine || ''}
              onChange={(e) => onUpdate({ ...d, subjectLine: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Sender Name</label>
            <input
              type="text"
              value={d.senderName || ''}
              onChange={(e) => onUpdate({ ...d, senderName: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Sender Email</label>
            <input
              type="email"
              value={d.senderEmail || ''}
              onChange={(e) => onUpdate({ ...d, senderEmail: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      );
    case 'delay':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Duration</label>
            <input
              type="number"
              min={1}
              value={d.duration || 1}
              onChange={(e) => onUpdate({ ...d, duration: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Unit</label>
            <select
              value={d.unit || 'days'}
              onChange={(e) => onUpdate({ ...d, unit: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>
        </div>
      );
    case 'abTest':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Split A %</label>
            <input
              type="number"
              min={1}
              max={99}
              value={d.splitA || 50}
              onChange={(e) => onUpdate({ ...d, splitA: Number(e.target.value), splitB: 100 - Number(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Split B %</label>
            <input
              type="number"
              value={d.splitB || 50}
              disabled
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-400"
            />
          </div>
          {(d.splitA || 50) + (d.splitB || 50) !== 100 && (
            <p className="text-xs text-red-500">Splits must sum to 100%</p>
          )}
        </div>
      );
    case 'audiencePath':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Condition Type</label>
            <select
              value={d.conditionType || 'engagement'}
              onChange={(e) => onUpdate({ ...d, conditionType: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="engagement">Engagement</option>
              <option value="attribute">Attribute</option>
              <option value="event">Event</option>
              <option value="segment">Segment Membership</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Condition Label</label>
            <input
              type="text"
              value={d.conditionLabel || ''}
              onChange={(e) => onUpdate({ ...d, conditionLabel: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Opened email"
            />
          </div>
          <p className="text-xs text-gray-400">Left branch = Yes, Right branch = No</p>
        </div>
      );
    default:
      return null;
  }
}

function CanvasInner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (!id) return;
    automationsApi.getAutomation(id).then((a) => {
      setAutomation(a);
      setNameValue(a.name);
      if (a.workflowJson?.nodes) setNodes(a.workflowJson.nodes);
      if (a.workflowJson?.edges) setEdges(a.workflowJson.edges);
    }).catch(() => toast.error('Failed to load automation'));
  }, [id]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNodeData = (nodeId: string, data: any) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data } : n));
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data } : null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType');
    if (!type || !rfInstanceRef.current) return;
    const position = rfInstanceRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode: Node = {
      id: generateId(),
      type,
      position,
      data: {},
    };
    setNodes((nds) => [...nds, newNode]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await automationsApi.updateAutomation(id, {
        name: nameValue,
        workflowJson: { nodes, edges },
      });
      toast.success('Automation saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!id) return;
    try {
      const updated = await automationsApi.activateAutomation(id);
      setAutomation(updated);
      toast.success('Automation activated');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Activation failed';
      toast.error(msg);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    try {
      const updated = await automationsApi.pauseAutomation(id);
      setAutomation(updated);
      toast.success('Automation paused');
    } catch {
      toast.error('Failed to pause');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left palette */}
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase">Nodes</p>
        </div>
        <div className="p-3 space-y-2 flex-1 overflow-y-auto">
          {paletteNodes.map((pn) => (
            <div
              key={pn.type}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('nodeType', pn.type)}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg cursor-grab hover:border-indigo-400 hover:bg-indigo-50 select-none text-sm text-gray-700"
            >
              <span>{pn.icon}</span>
              <span className="text-xs font-medium">{pn.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => navigate('/automations')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Automations
          </button>

          <div className="h-5 w-px bg-gray-200" />

          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              autoFocus
              className="text-sm font-semibold text-gray-900 border-b border-indigo-500 outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
              title="Click to rename"
            >
              {nameValue || automation?.name || 'Untitled Automation'}
            </button>
          )}

          {automation && <StatusBadge status={automation.status} />}

          <div className="ml-auto flex items-center gap-2">
            {automation?.status !== 'active' && (
              <button
                onClick={handleActivate}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
              >
                Activate
              </button>
            )}
            {automation?.status === 'active' && (
              <button
                onClick={handlePause}
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
              >
                Pause
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-md disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden" onDrop={handleDrop} onDragOver={handleDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            onInit={(instance) => { rfInstanceRef.current = instance; }}
            fitView
          >
            <Background gap={16} size={1} color="#e5e7eb" />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Right node settings */}
      {selectedNode && (
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Node Settings</p>
            <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <NodeSettings
              node={selectedNode}
              onUpdate={(data) => updateNodeData(selectedNode.id, data)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AutomationCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
