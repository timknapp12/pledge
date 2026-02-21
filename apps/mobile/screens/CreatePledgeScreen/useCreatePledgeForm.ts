import { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreatePledgeInDb,
  parseUsdcToLamports,
  type Todo,
  type ReminderSettings,
} from '@/hooks/useSupabase';
import { useProgram } from '@/hooks/useProgram';
import { useNotifications } from '@/hooks/useNotifications';
import { type DurationPreset } from '@/components';

const MAX_DAILY_TRACKING_DAYS = 7;

export const useCreatePledgeForm = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { walletAddress } = useAuth();

  const { createPledge, error: programError } = useProgram();
  const createPledgeInDb = useCreatePledgeInDb();
  const { registerForPushNotifications } = useNotifications();

  // Form state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  });
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('1week');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [reminderSettings, setReminderSettings] =
    useState<ReminderSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bottom sheet refs
  const startDateSheetRef = useRef<BottomSheet>(null);
  const durationSheetRef = useRef<BottomSheet>(null);
  const remindersSheetRef = useRef<BottomSheet>(null);
  const dailyTodosSheetRef = useRef<BottomSheet>(null);

  // Computed values
  const durationDays = useMemo(() => {
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  const showDailyTracking =
    durationDays > 1 && durationDays <= MAX_DAILY_TRACKING_DAYS;

  const hasDailyAssignments = useMemo(() => {
    return todos.some((todo) => todo.days !== null);
  }, [todos]);

  const isValid =
    name.trim() && todos.length > 0 && parseFloat(stakeAmount) > 0;

  // Handlers
  const handleAddTodo = useCallback(() => {
    if (newTodo.trim()) {
      setTodos((prev) => [...prev, { text: newTodo.trim(), days: null }]);
      setNewTodo('');
    }
  }, [newTodo]);

  const handleRemoveTodo = useCallback((index: number) => {
    setTodos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartDateConfirm = useCallback(
    (date: Date) => {
      setStartDate(date);
      if (endDate <= date) {
        const newEnd = new Date(date);
        newEnd.setDate(newEnd.getDate() + 7);
        setEndDate(newEnd);
        setDurationPreset('1week');
      }
    },
    [endDate]
  );

  const handleDurationConfirm = useCallback(
    (end: Date, preset: DurationPreset) => {
      setEndDate(end);
      setDurationPreset(preset);
      const newDurationDays = Math.ceil(
        (end.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (newDurationDays <= 1 || newDurationDays > MAX_DAILY_TRACKING_DAYS) {
        setTodos((prev) => prev.map((todo) => ({ ...todo, days: null })));
      }
    },
    [startDate]
  );

  const handleRemindersConfirm = useCallback(
    (settings: ReminderSettings | null) => {
      setReminderSettings(settings);
    },
    []
  );

  const handleDailyTodosConfirm = useCallback((updatedTodos: Todo[]) => {
    setTodos(updatedTodos);
  }, []);

  // Label helpers
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDurationLabel = (): string => {
    if (durationDays === 1) return `1 ${t('day')}`;
    if (durationDays === 7) return `1 ${t('week')}`;
    if (durationDays === 30) return `1 ${t('Month')}`;
    return `${durationDays} ${t('days')}`;
  };

  const formatReminderTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getRemindersLabel = (): string => {
    if (!reminderSettings || reminderSettings.reminders.length === 0) {
      return t('None');
    }
    const parts: string[] = [];
    const dailyReminder = reminderSettings.reminders.find(
      (r) => r.type === 'daily'
    );
    if (dailyReminder?.time) {
      parts.push(`${t('Daily at')} ${formatReminderTime(dailyReminder.time)}`);
    }
    const deadlineReminders = reminderSettings.reminders
      .filter((r) => r.type === 'before_deadline' && r.hours)
      .map((r) => {
        if (r.hours === 24) return t('1 day before');
        if (r.hours === 1) return t('1 hour before');
        return `${r.hours} ${t('hours before')}`;
      });
    if (deadlineReminders.length > 0) {
      parts.push(deadlineReminders.join(', '));
    }
    return parts.join(', ') || t('None');
  };

  const getDailyTrackingLabel = (): string => {
    if (hasDailyAssignments) {
      return t('Custom schedule');
    }
    return t('Every day');
  };

  const handleCreate = async () => {
    if (!isValid || !walletAddress) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const stakeAmountNumber = parseFloat(stakeAmount);

      const result = await createPledge(stakeAmountNumber, endDate);

      if (!result?.pledgeAddress) {
        throw new Error('Failed to create pledge on-chain');
      }

      // Ensure push token is registered before scheduling notifications
      if (reminderSettings?.reminders?.length) {
        await registerForPushNotifications();
      }

      await createPledgeInDb.mutateAsync({
        on_chain_address: result.pledgeAddress.toString(),
        name: name.trim(),
        timeframe_type: durationPreset,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        deadline: endDate.toISOString(),
        stake_amount: parseUsdcToLamports(stakeAmount),
        todos: todos,
        reminder_settings: reminderSettings,
      });

      router.back();
    } catch (err: any) {
      console.error('Create pledge error:', err);
      setError(err.message || 'Failed to create pledge');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // State
    name,
    setName,
    startDate,
    endDate,
    durationPreset,
    todos,
    newTodo,
    setNewTodo,
    stakeAmount,
    setStakeAmount,
    reminderSettings,
    isSubmitting,
    error,
    programError,

    // Refs
    startDateSheetRef,
    durationSheetRef,
    remindersSheetRef,
    dailyTodosSheetRef,

    // Computed
    showDailyTracking,
    isValid,

    // Handlers
    handleAddTodo,
    handleRemoveTodo,
    handleStartDateConfirm,
    handleDurationConfirm,
    handleRemindersConfirm,
    handleDailyTodosConfirm,
    handleCreate,

    // Labels
    formatDate,
    formatTime,
    getDurationLabel,
    getRemindersLabel,
    getDailyTrackingLabel,
  };
};
