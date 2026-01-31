// Supabase data hooks using React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

// Types matching Supabase schema
export interface Todo {
  text: string;
  days?: number[] | null; // [0-6] for specific days, null for all days
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
  todos: Todo[];
  status: 'Active' | 'Reported' | 'Completed' | 'Forfeited';
  completion_percentage: number | null;
  points_earned: number | null;
  created_at: string;
}

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
  todos: Todo[];
  default_timeframe: string;
  created_at: string;
}

// Query keys for cache management
export const queryKeys = {
  pledges: (walletAddress: string) => ['pledges', walletAddress] as const,
  pledge: (pledgeId: string) => ['pledge', pledgeId] as const,
  dailyProgress: (pledgeId: string, date?: string) =>
    ['dailyProgress', pledgeId, date] as const,
  templates: (walletAddress: string) => ['templates', walletAddress] as const,
};

// Fetch all pledges for the current user
export function usePledges() {
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
  });
}

// Fetch active pledges only
export function useActivePledges() {
  const { supabase, walletAddress } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.pledges(walletAddress ?? ''), 'active'] as const,
    queryFn: async (): Promise<Pledge[]> => {
      if (!walletAddress) return [];

      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .eq('status', 'Active')
        .order('deadline', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!walletAddress,
  });
}

// Fetch a single pledge with its daily progress
export function usePledge(pledgeId: string | null) {
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
export function useDailyProgress(pledgeId: string | null, date?: string) {
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
export function useTodayProgress(pledgeId: string | null) {
  const today = new Date().toISOString().split('T')[0];
  return useDailyProgress(pledgeId, today);
}

// Update daily progress (check/uncheck todos)
export function useUpdateDailyProgress() {
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
    },
  });
}

// Create a new pledge in the database (after on-chain creation succeeds)
export function useCreatePledgeInDb() {
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
      todos: Todo[];
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
          status: 'Active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate pledges list
      queryClient.invalidateQueries({ queryKey: ['pledges'] });
    },
  });
}

// Update pledge status in database
export function useUpdatePledgeStatus() {
  const { supabase } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pledgeId,
      status,
      completionPercentage,
    }: {
      pledgeId: string;
      status: Pledge['status'];
      completionPercentage?: number;
    }) => {
      const updateData: Partial<Pledge> = { status };
      if (completionPercentage !== undefined) {
        updateData.completion_percentage = completionPercentage;
      }

      const { data, error } = await supabase
        .from('pledges')
        .update(updateData)
        .eq('id', pledgeId)
        .select()
        .single();

      if (error) throw error;
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
export function useTemplates() {
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
export function useCreateTemplate() {
  const { supabase, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      name: string;
      todos: Todo[];
      default_timeframe: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: template.name,
          todos: template.todos,
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

// Calculate completion percentage from daily progress
export function calculateCompletionPercentage(
  todos: Todo[],
  dailyProgress: DailyProgress[],
  startDate: Date,
  endDate: Date
): number {
  if (todos.length === 0) return 0;

  let totalExpectedCompletions = 0;
  let actualCompletions = 0;

  // Count days in the pledge period
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday
    const dateStr = currentDate.toISOString().split('T')[0];

    // Find progress for this day
    const dayProgress = dailyProgress.find((p) => p.date === dateStr);
    const completedIndices = dayProgress?.todos_completed ?? [];

    // Check each todo
    todos.forEach((todo, index) => {
      // If todo has specific days, check if current day is included
      if (todo.days === null || todo.days === undefined || todo.days.includes(dayOfWeek)) {
        totalExpectedCompletions++;
        if (completedIndices.includes(index)) {
          actualCompletions++;
        }
      }
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (totalExpectedCompletions === 0) return 0;
  return Math.round((actualCompletions / totalExpectedCompletions) * 100);
}

// Format stake amount from lamports to USDC string
export function formatUsdcAmount(lamports: number): string {
  const usdc = lamports / 1_000_000;
  return usdc.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Parse USDC string to lamports
export function parseUsdcToLamports(usdcString: string): number {
  const usdc = parseFloat(usdcString.replace(/,/g, ''));
  if (isNaN(usdc)) return 0;
  return Math.round(usdc * 1_000_000);
}
