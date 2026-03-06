// Supabase data hooks using React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from './queryKeys';

// Re-export queryKeys for backward compatibility
export { queryKeys };

// Local date string helper — avoids UTC offset issues with toISOString()
export const toLocalDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Types matching Supabase schema

export interface PledgeTodos {
  goals: string[]; // non-daily tasks for the whole pledge
  daily: Record<string, string[]>; // "YYYY-MM-DD" -> task texts for that day
}

// Task schedule types for creation flow
export type TaskSchedule =
  | 'not_daily'
  | 'every_day'
  | 'weekdays'
  | 'weekends'
  | 'custom';

export interface TaskDefinition {
  text: string;
  schedule: TaskSchedule;
  customDays?: number[]; // day-of-week indices for 'custom' (0=Sun)
}

// Get total task count
export const getTotalTaskCount = (todos: PledgeTodos): number => {
  const uniqueDailyTasks = new Set(Object.values(todos.daily).flat());
  return todos.goals.length + uniqueDailyTasks.size;
};

// Compute PledgeTodos from task definitions and date range
export const computePledgeTodos = (
  taskDefs: TaskDefinition[],
  startDate: Date,
  endDate: Date
): PledgeTodos => {
  const goals: string[] = [];
  const daily: Record<string, string[]> = {};

  // Generate all dates in range (exclusive of end date)
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const dates: { dateStr: string; dayOfWeek: number }[] = [];
  while (current < end) {
    dates.push({
      dateStr: toLocalDateStr(current),
      dayOfWeek: current.getDay(),
    });
    current.setDate(current.getDate() + 1);
  }

  for (const def of taskDefs) {
    if (def.schedule === 'not_daily') {
      goals.push(def.text);
      continue;
    }

    for (const { dateStr, dayOfWeek } of dates) {
      let include = false;
      switch (def.schedule) {
        case 'every_day':
          include = true;
          break;
        case 'weekdays':
          include = dayOfWeek >= 1 && dayOfWeek <= 5;
          break;
        case 'weekends':
          include = dayOfWeek === 0 || dayOfWeek === 6;
          break;
        case 'custom':
          include = def.customDays?.includes(dayOfWeek) ?? false;
          break;
      }
      if (include) {
        if (!daily[dateStr]) daily[dateStr] = [];
        daily[dateStr].push(def.text);
      }
    }
  }

  return { goals, daily };
};

// Get daily tasks for a specific date
export const getDailyTasksForDate = (
  todos: PledgeTodos,
  date: string
): string[] => {
  return todos.daily[date] || [];
};

// Get goals (non-daily tasks)
export const getGoals = (todos: PledgeTodos): string[] => {
  return todos.goals;
};

export interface ReminderConfig {
  type: 'daily' | 'before_deadline';
  time?: string; // "HH:mm" for daily
  hours?: number; // hours before deadline
}

export interface ReminderSettings {
  reminders: ReminderConfig[];
}

export interface Pledge {
  id: string;
  user_id: string;
  on_chain_address: string;
  name: string;
  timeframe_type: string;
  start_date: string;
  end_date: string;
  deadline: string;
  stake_amount: number; // in USDC lamports (6 decimals)
  todos: PledgeTodos;
  status: 'Active' | 'Reported' | 'Completed' | 'Forfeited';
  completion_percentage: number | null;
  settle_tx_signature: string | null;
  points_earned: number | null;
  reminder_settings: ReminderSettings | null;
  created_at: string;
}

export type PledgeDisplayStatus = Pledge['status'] | 'Expired';

/** Frontend failsafe: if deadline + 24h grace has passed and crank hasn't updated status, treat as Expired. */
export const getEffectiveStatus = (pledge: Pledge): PledgeDisplayStatus => {
  if (pledge.status !== 'Active') return pledge.status;
  const gracePeriodMs = 24 * 60 * 60 * 1000;
  const deadlinePlusGrace = new Date(pledge.deadline).getTime() + gracePeriodMs;
  if (Date.now() > deadlinePlusGrace) return 'Expired';
  return 'Active';
};

export interface DailyProgress {
  id: string;
  pledge_id: string;
  date: string;
  todos_completed: number[]; // indices of completed todos
  created_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  todos: PledgeTodos;
  task_definitions: TaskDefinition[] | null;
  default_timeframe: string;
  created_at: string;
}


// Fetch all pledges for the current user
export const usePledges = () => {
  const { supabase, walletAddress } = useAuth();

  return useQuery({
    queryKey: queryKeys.pledges(walletAddress ?? ''),
    queryFn: async (): Promise<Pledge[]> => {
      if (!walletAddress) return [];

      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!walletAddress,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

// Fetch active pledges only (derived from usePledges to share cache)
export const useActivePledges = () => {
  const pledgesQuery = usePledges();

  return {
    ...pledgesQuery,
    data: pledgesQuery.data
      ?.filter((p) => {
        const effective = getEffectiveStatus(p);
        return effective === 'Active' || effective === 'Reported';
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
  };
}

// Fetch completion progress for all active pledges in one query
export const useActivePledgeProgress = (pledges: Pledge[] | undefined) => {
  const { supabase, walletAddress } = useAuth();
  const pledgeIds = pledges?.map((p) => p.id) ?? [];

  const progressQuery = useQuery({
    queryKey: queryKeys.allActivePledgeProgress(walletAddress ?? '', pledgeIds),
    queryFn: async (): Promise<DailyProgress[]> => {
      if (!walletAddress || pledgeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .in('pledge_id', pledgeIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!walletAddress && pledgeIds.length > 0,
  });

  // Build a map of pledgeId -> completion percentage
  const progressMap = new Map<string, number>();
  if (pledges && progressQuery.data) {
    const progressByPledge = new Map<string, DailyProgress[]>();
    for (const row of progressQuery.data) {
      const arr = progressByPledge.get(row.pledge_id) ?? [];
      arr.push(row);
      progressByPledge.set(row.pledge_id, arr);
    }
    for (const pledge of pledges) {
      const dp = progressByPledge.get(pledge.id) ?? [];
      progressMap.set(
        pledge.id,
        calculateCompletionPercentage(
          pledge.todos,
          dp,
          new Date(pledge.start_date),
          new Date(pledge.end_date),
        ),
      );
    }
  }

  return { ...progressQuery, progressMap };
};

// Fetch a single pledge with its daily progress
export const usePledge = (pledgeId: string | null) => {
  const { supabase, walletAddress } = useAuth();

  return useQuery({
    queryKey: queryKeys.pledge(pledgeId ?? ''),
    queryFn: async (): Promise<Pledge | null> => {
      if (!pledgeId || !walletAddress) return null;

      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .eq('id', pledgeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!pledgeId && !!walletAddress,
  });
}

// Fetch daily progress for a pledge
export const useDailyProgress = (pledgeId: string | null, date?: string) => {
  const { supabase, walletAddress } = useAuth();

  return useQuery({
    queryKey: queryKeys.dailyProgress(pledgeId ?? '', date),
    queryFn: async (): Promise<DailyProgress[]> => {
      if (!pledgeId || !walletAddress) return [];

      let query = supabase
        .from('daily_progress')
        .select('*')
        .eq('pledge_id', pledgeId)
        .order('date', { ascending: false });

      if (date) {
        query = query.eq('date', date);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!pledgeId && !!walletAddress,
  });
}

// Get today's progress for a pledge
export const useTodayProgress = (pledgeId: string | null) => {
  const today = toLocalDateStr(new Date());
  return useDailyProgress(pledgeId, today);
}

// Fetch daily progress for ALL of a user's pledges on a given date
export const useAllDailyProgress = (date: string) => {
  const { supabase, walletAddress } = useAuth();

  return useQuery({
    queryKey: queryKeys.allDailyProgress(walletAddress ?? '', date),
    queryFn: async (): Promise<DailyProgress[]> => {
      if (!walletAddress) return [];

      const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('date', date);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!walletAddress,
  });
}

// Update daily progress (check/uncheck todos)
export const useUpdateDailyProgress = () => {
  const { supabase } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pledgeId,
      date,
      todosCompleted,
    }: {
      pledgeId: string;
      date: string;
      todosCompleted: number[];
    }) => {
      // Upsert - create if doesn't exist, update if does
      const { data, error } = await supabase
        .from('daily_progress')
        .upsert(
          {
            pledge_id: pledgeId,
            date,
            todos_completed: todosCompleted,
          },
          {
            onConflict: 'pledge_id,date',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyProgress(variables.pledgeId),
      });
      // Also invalidate the all-pledges daily progress cache (HomeScreen tasks view)
      queryClient.invalidateQueries({
        queryKey: ['allDailyProgress'],
      });
      // Invalidate active pledge progress (HomeScreen pledge cards)
      queryClient.invalidateQueries({
        queryKey: ['allActivePledgeProgress'],
      });
    },
  });
}

// Create a new pledge in the database (after on-chain creation succeeds)
export const useCreatePledgeInDb = () => {
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pledge: {
      on_chain_address: string;
      name: string;
      timeframe_type: string;
      start_date: string;
      end_date: string;
      deadline: string;
      stake_amount: number;
      todos: PledgeTodos;
      reminder_settings?: ReminderSettings | null;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pledges')
        .insert({
          user_id: user.id,
          on_chain_address: pledge.on_chain_address,
          name: pledge.name,
          timeframe_type: pledge.timeframe_type,
          start_date: pledge.start_date,
          end_date: pledge.end_date,
          deadline: pledge.deadline,
          stake_amount: pledge.stake_amount,
          todos: pledge.todos,
          reminder_settings: pledge.reminder_settings ?? null,
          status: 'Active',
        })
        .select()
        .single();

      if (error) throw error;

      // Schedule notifications if reminder settings are configured
      if (pledge.reminder_settings?.reminders?.length) {
        const { error: rpcError } = await supabase.rpc(
          'schedule_pledge_notifications',
          { p_pledge_id: data.id, p_user_id: user.id }
        );
        if (rpcError) {
          console.error('Failed to schedule notifications:', rpcError);
          // Non-fatal: pledge was created successfully
        }
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate pledges list
      queryClient.invalidateQueries({ queryKey: ['pledges'] });
    },
  });
}

// Update pledge status in database
export const useUpdatePledgeStatus = () => {
  const { supabase } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pledgeId,
      status,
      completionPercentage,
      settleTxSignature,
    }: {
      pledgeId: string;
      status: Pledge['status'];
      completionPercentage?: number;
      settleTxSignature?: string;
    }) => {
      const updateData: Record<string, unknown> = { status };
      if (completionPercentage !== undefined) {
        updateData.completion_percentage = completionPercentage;
      }
      if (settleTxSignature) {
        updateData.settle_tx_signature = settleTxSignature;
      }

      const { data, error } = await supabase
        .from('pledges')
        .update(updateData)
        .eq('id', pledgeId)
        .select()
        .single();

      if (error) throw error;

      // Cancel pending notifications when pledge is completed or forfeited
      if (status === 'Completed' || status === 'Forfeited') {
        const { error: cancelError } = await supabase
          .from('notifications')
          .update({ status: 'cancelled' })
          .eq('pledge_id', pledgeId)
          .eq('status', 'pending');
        if (cancelError) {
          console.error('Failed to cancel notifications:', cancelError);
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pledge(variables.pledgeId),
      });
      queryClient.invalidateQueries({ queryKey: ['pledges'] });
    },
  });
}

// Fetch user's templates
export const useTemplates = () => {
  const { supabase, walletAddress } = useAuth();

  return useQuery({
    queryKey: queryKeys.templates(walletAddress ?? ''),
    queryFn: async (): Promise<Template[]> => {
      if (!walletAddress) return [];

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!walletAddress,
  });
}

// Create a new template
export const useCreateTemplate = () => {
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      name: string;
      todos: PledgeTodos;
      task_definitions: TaskDefinition[];
      default_timeframe: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: template.name,
          todos: template.todos,
          task_definitions: template.task_definitions,
          default_timeframe: template.default_timeframe,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

// Delete a template
export const useDeleteTemplate = () => {
  const { supabase } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

// Calculate completion percentage from daily progress.
// Only daily tasks count toward percentage. Goals are tracked separately.
export const calculateCompletionPercentage = (
  todos: PledgeTodos,
  dailyProgress: DailyProgress[],
  startDate: Date,
  endDate: Date
): number => {
  let totalExpectedCompletions = 0;
  let actualCompletions = 0;

  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  // Don't count future days — cap at today
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const end = new Date(Math.min(endDate.getTime(), now.getTime()));

  const goalCount = todos.goals.length;
  const todayStr = toLocalDateStr(new Date());

  // Count daily tasks per day
  while (currentDate <= end) {
    const dateStr = toLocalDateStr(currentDate);
    const dayProgress = dailyProgress.find((p) => p.date === dateStr);
    const completedIndices = dayProgress?.todos_completed ?? [];

    const dayTasks = todos.daily[dateStr] || [];
    totalExpectedCompletions += dayTasks.length;
    actualCompletions += completedIndices.filter(
      (i) => i >= 0 && i < dayTasks.length
    ).length;

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Goals count once — completion stored in today's progress after daily task indices
  if (goalCount > 0) {
    totalExpectedCompletions += goalCount;
    const todayProgress = dailyProgress.find((p) => p.date === todayStr);
    const todayDayTasks = todos.daily[todayStr] || [];
    const completedIndices = todayProgress?.todos_completed ?? [];
    actualCompletions += completedIndices.filter(
      (i) => i >= todayDayTasks.length && i < todayDayTasks.length + goalCount
    ).length;
  }

  if (totalExpectedCompletions === 0) return 0;
  return Math.round((actualCompletions / totalExpectedCompletions) * 100);
}

// Format stake amount from lamports to USDC string
export const formatUsdcAmount = (lamports: number): string => {
  const usdc = lamports / 1_000_000;
  return usdc.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Parse USDC string to lamports
export const parseUsdcToLamports = (usdcString: string): number => {
  const usdc = parseFloat(usdcString.replace(/,/g, ''));
  if (isNaN(usdc)) return 0;
  return Math.round(usdc * 1_000_000);
}
