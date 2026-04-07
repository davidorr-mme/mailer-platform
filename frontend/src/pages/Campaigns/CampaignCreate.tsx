import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { campaignsApi } from '../../api/campaigns';
import { segmentsApi } from '../../api/segments';
import { Campaign, EmailBlock, Segment } from '../../types';
import EmailBuilder, { renderBlocksToHtml } from './EmailBuilder';
import Modal from '../../components/Modal';

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { num: 1, label: 'Settings' },
  { num: 2, label: 'Audience' },
  { num: 3, label: 'Design' },
  { num: 4, label: 'Review' },
];

interface SettingsForm {
  name: string;
  subjectLine: string;
  previewText: string;
  senderName: string;
  senderEmail: string;
}

export default function CampaignCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [step, setStep] = useState<Step>(1);
  const [campaignId, setCampaignId] = useState<string | null>(id || null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [segmentEstimate, setSegmentEstimate] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [templateChanged, setTemplateChanged] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const autoSaveRef = useRef<number | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SettingsForm>();

  useEffect(() => {
    segmentsApi.getSegments(1, 100).then((data) => setSegments(data.items)).catch(() => {});

    if (id) {
      campaignsApi.getCampaign(id).then((c) => {
        setCampaign(c);
        reset({
          name: c.name,
          subjectLine: c.subjectLine,
          previewText: c.previewText,
          senderName: c.senderName,
          senderEmail: c.senderEmail,
        });
        setSelectedSegmentId(c.segmentId || '');
        setBlocks(c.templateJson || []);
      }).catch(() => toast.error('Failed to load campaign'));
    }
  }, [id]);

  // Auto-save every 60s on step 3
  useEffect(() => {
    if (step === 3) {
      autoSaveRef.current = window.setInterval(async () => {
        if (campaignId && templateChanged) {
          try {
            const html = renderBlocksToHtml(blocks);
            await campaignsApi.updateCampaign(campaignId, { templateJson: blocks, templateHtml: html });
            setTemplateChanged(false);
          } catch {}
        }
      }, 60000);
    }
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [step, campaignId, blocks, templateChanged]);

  const handleBlocksChange = (newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks);
    setTemplateChanged(true);
  };

  const handleSettingsNext = async (data: SettingsForm) => {
    try {
      if (campaignId) {
        const c = await campaignsApi.updateCampaign(campaignId, data);
        setCampaign(c);
      } else {
        const c = await campaignsApi.createCampaign({ ...data, status: 'draft' });
        setCampaign(c);
        setCampaignId(c.id);
      }
      setStep(2);
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleAudienceNext = async () => {
    if (!campaignId) return;
    try {
      await campaignsApi.updateCampaign(campaignId, { segmentId: selectedSegmentId || null });
      setStep(3);
    } catch {
      toast.error('Failed to save audience');
    }
  };

  const handleDesignNext = async () => {
    if (!campaignId) return;
    try {
      const html = renderBlocksToHtml(blocks);
      await campaignsApi.updateCampaign(campaignId, { templateJson: blocks, templateHtml: html });
      setTemplateChanged(false);
      setStep(4);
    } catch {
      toast.error('Failed to save design');
    }
  };

  const handleSegmentChange = async (segId: string) => {
    setSelectedSegmentId(segId);
    setSegmentEstimate(null);
    if (segId) {
      try {
        const result = await segmentsApi.estimateSegmentById(segId);
        setSegmentEstimate(result.count);
      } catch {}
    }
  };

  const handleSendNow = async () => {
    if (!campaignId) return;
    try {
      await campaignsApi.sendCampaign(campaignId);
      toast.success('Campaign sent successfully!');
      setSendModalOpen(false);
      navigate('/campaigns');
    } catch {
      toast.error('Failed to send campaign');
    }
  };

  const handleSchedule = async () => {
    if (!campaignId || !scheduleDateTime) return;
    try {
      await campaignsApi.scheduleCampaign(campaignId, new Date(scheduleDateTime).toISOString());
      toast.success('Campaign scheduled!');
      setScheduleModalOpen(false);
      navigate('/campaigns');
    } catch {
      toast.error('Failed to schedule campaign');
    }
  };

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step === s.num
                    ? 'bg-indigo-600 text-white'
                    : step > s.num
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-xs mt-1 font-medium ${step === s.num ? 'text-indigo-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 w-16 mx-2 mb-3 transition-colors ${step > s.num ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Settings */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Campaign Settings</h2>
          <form onSubmit={handleSubmit(handleSettingsNext)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Summer Sale Announcement"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line *</label>
                <input
                  {...register('subjectLine', { required: 'Subject line is required' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Your email subject..."
                />
                {errors.subjectLine && <p className="mt-1 text-xs text-red-600">{errors.subjectLine.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Preview Text</label>
                <input
                  {...register('previewText')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Brief preview shown in inbox..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                <input
                  {...register('senderName')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
                <input
                  type="email"
                  {...register('senderEmail')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="noreply@yourdomain.com"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-md">
                Next: Audience
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: Audience */}
      {step === 2 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Choose Audience</h2>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">Segment</label>
            <select
              value={selectedSegmentId}
              onChange={(e) => handleSegmentChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a segment...</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {segmentEstimate !== null && (
              <div className="mt-3 inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium text-indigo-700">
                  Estimated recipients: {segmentEstimate.toLocaleString()} contacts
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
              Back
            </button>
            <button onClick={handleAudienceNext} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-md">
              Next: Design
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Design */}
      {step === 3 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Design Email</h2>
          </div>
          <div style={{ height: 600 }}>
            <EmailBuilder value={blocks} onChange={handleBlocksChange} />
          </div>
          <div className="flex justify-between px-6 py-4 border-t border-gray-200">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
              Back
            </button>
            <button onClick={handleDesignNext} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-md">
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && campaign && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Review & Send</h2>
          <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200 mb-6">
            {[
              { label: 'Campaign Name', value: campaign.name },
              { label: 'Subject Line', value: campaign.subjectLine },
              { label: 'Preview Text', value: campaign.previewText || '—' },
              { label: 'Sender', value: campaign.senderName ? `${campaign.senderName} <${campaign.senderEmail}>` : campaign.senderEmail || '—' },
              { label: 'Segment', value: selectedSegment?.name || '—' },
              { label: 'Estimated Contacts', value: segmentEstimate !== null ? segmentEstimate.toLocaleString() : (selectedSegment?.contactCount?.toLocaleString() || '—') },
              { label: 'Email Blocks', value: `${blocks.length} block${blocks.length !== 1 ? 's' : ''}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center px-4 py-3 gap-4">
                <span className="text-sm font-medium text-gray-500 w-44 flex-shrink-0">{label}</span>
                <span className="text-sm text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(3)} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
              Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setScheduleModalOpen(true)}
                className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                Schedule
              </button>
              <button
                onClick={() => setSendModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-md"
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Now Confirmation */}
      <Modal isOpen={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Send Campaign" size="sm">
        <p className="text-sm text-gray-600 mb-2">
          You're about to send <strong>{campaign?.name}</strong> to your selected audience.
        </p>
        <p className="text-sm text-gray-600 mb-4">This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setSendModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSendNow} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">
            Send Now
          </button>
        </div>
      </Modal>

      {/* Schedule Modal */}
      <Modal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} title="Schedule Campaign" size="sm">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Send Date & Time</label>
          <input
            type="datetime-local"
            value={scheduleDateTime}
            onChange={(e) => setScheduleDateTime(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setScheduleModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={!scheduleDateTime}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-60"
          >
            Schedule
          </button>
        </div>
      </Modal>
    </div>
  );
}
