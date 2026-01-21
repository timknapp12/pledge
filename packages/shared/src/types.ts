// Pledge status enum - matches on-chain state
export enum PledgeStatus {
  Active = 'Active',
  Reported = 'Reported',
  Completed = 'Completed',
  Forfeited = 'Forfeited',
}

// Timeframe presets
export enum TimeframeType {
  OneDay = '1_day',
  OneWeek = '1_week',
  OneMonth = '1_month',
  Custom = 'custom',
}

// To-do item structure
export interface TodoItem {
  text: string;
  days: number[] | null; // [0-6] for specific days, null for all days
}

// Template structure
export interface PledgeTemplate {
  id: string;
  userId: string;
  name: string;
  todos: TodoItem[];
  defaultTimeframe: TimeframeType;
  createdAt: string;
}

// Pledge structure (matches DB schema)
export interface Pledge {
  id: string;
  userId: string;
  onChainAddress: string;
  name: string;
  timeframeType: TimeframeType;
  startDate: string;
  endDate: string;
  deadline: string;
  stakeAmount: number; // in USDC (6 decimals)
  todos: TodoItem[];
  status: PledgeStatus;
  completionPercentage: number | null;
  pointsEarned: number | null;
  createdAt: string;
}

// Daily progress structure
export interface DailyProgress {
  id: string;
  pledgeId: string;
  date: string;
  todosCompleted: number[]; // indices of completed todos
  createdAt: string;
}

// User structure
export interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  pfpUrl: string | null;
  points: number;
  streakCurrent: number;
  streakBest: number;
  githubUsername: string | null; // V2
  xUsername: string | null; // V2
  notificationPreferences: NotificationPreferences | null;
  createdAt: string;
}

// Notification preferences
export interface NotificationPreferences {
  reminderBeforeDeadline: number | null; // hours before deadline
  deadlineReached: boolean;
  timeToReport: boolean;
  goalCompleted: boolean;
}

// Create pledge input
export interface CreatePledgeInput {
  name: string;
  timeframeType: TimeframeType;
  startDate: string;
  endDate: string;
  stakeAmount: number;
  todos: TodoItem[];
  templateId?: string; // if created from template
}

// Report completion input
export interface ReportCompletionInput {
  pledgeId: string;
  completionPercentage: number; // 0-100
}
