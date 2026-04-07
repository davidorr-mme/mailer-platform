export interface User {
  id: string;
  email: string;
}

export interface AttributeDefinition {
  id: string;
  name: string;
  dataType: 'text' | 'number' | 'boolean';
  createdAt: string;
}

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  email: string;
  globalUnsubscribe: boolean;
  customAttributes: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomEvent {
  id: string;
  contactId: string;
  eventName: string;
  occurredAt: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface Condition {
  type: 'attribute' | 'event';
  field: string;
  operator: string;
  value?: any;
  dateRange?: {
    unit: 'days' | 'weeks' | 'months';
    value: number;
    direction: 'last' | 'next';
  };
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

export interface SegmentLogic {
  operator: 'AND' | 'OR';
  groups: ConditionGroup[];
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  logic: SegmentLogic;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  subjectLine: string;
  previewText: string;
  senderName: string;
  senderEmail: string;
  templateJson: EmailBlock[];
  templateHtml: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduledAt: string | null;
  sentAt: string | null;
  segmentId: string | null;
  segmentName?: string;
  createdAt: string;
  updatedAt: string;
  openRate?: number;
  clickRate?: number;
}

export interface EmailBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'html';
  content?: string;
  settings?: Record<string, any>;
}

export interface Automation {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  entryCriteria: any;
  exitCriteria: any[];
  targetSegmentId: string | null;
  workflowJson: { nodes: any[]; edges: any[] };
  enrolledCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSend {
  id: string;
  campaignId: string;
  contactId: string;
  status: 'queued' | 'sent' | 'bounced' | 'failed';
  sentAt: string | null;
}

export interface EngagementEvent {
  id: string;
  type: 'open' | 'click' | 'unsubscribe' | 'bounce' | 'spam_complaint';
  url?: string;
  occurredAt: string;
}

export interface ImportHistory {
  id: string;
  importType: 'contacts' | 'events';
  fileName: string;
  rowsProcessed: number;
  contactsCreated: number;
  contactsUpdated: number;
  eventsCreated: number;
  errorsCount: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardKpis {
  totalContacts: number;
  activeAutomations: number;
  campaignsSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  unsubscribeRate: number;
}

export interface PerformanceDataPoint {
  date: string;
  openRate: number;
  clickRate: number;
}

export interface CampaignReport {
  id: string;
  name: string;
  subjectLine: string;
  segmentName: string;
  sentAt: string;
  status: string;
  recipients: number;
  delivered: number;
  deliveryRate: number;
  opensUnique: number;
  openRate: number;
  clicksUnique: number;
  clickRate: number;
  ctor: number;
  unsubscribes: number;
  unsubscribeRate: number;
  bounces: number;
  bounceRate: number;
  spamComplaints: number;
  engagementOverTime: { timestamp: string; opens: number; clicks: number }[];
}
