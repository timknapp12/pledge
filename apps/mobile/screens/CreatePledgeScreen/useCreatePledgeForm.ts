import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreatePledgeInDb,
  useCreateTemplate,
  useTemplates,
  parseUsdcToLamports,
  computePledgeTodos,
  type TaskDefinition,
  type PledgeTodos,
  type ReminderSettings,
} from '@/hooks/useSupabase';
import { useProgram } from '@/hooks/useProgram';
import { useNotifications } from '@/hooks/useNotifications';
import { type DurationPreset } from '@/components';

const MAX_DAILY_TRACKING_DAYS = 90;

const DURATION_DAYS: Record<string, number> = {
  '1day': 1,
  '1week': 7,
  '1month': 30,
};

export const useCreatePledgeForm = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { walletAddress } = useAuth();

  const { createPledge, error: programError } = useProgram();
  const createPledgeInDb = useCreatePledgeInDb();
  const createTemplate = useCreateTemplate();
  const { data: templates } = useTemplates();
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
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  const [stakeAmount, setStakeAmount] = useState('');
  const [reminderSettings, setReminderSettings] =
    useState<ReminderSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateDirty, setTemplateDirty] = useState(false);

  // Bottom sheet refs
  const startDateSheetRef = useRef<BottomSheet>(null);
  const durationSheetRef = useRef<BottomSheet>(null);
  const remindersSheetRef = useRef<BottomSheet>(null);
  const stakeAmountSheetRef = useRef<BottomSheet>(null);
  const saveTemplateSheetRef = useRef<BottomSheet>(null);

  // Load template when templateId is present
  useEffect(() => {
    if (!templateId || !templates) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    if (template.task_definitions) {
      setTaskDefinitions(template.task_definitions);
    }

    const preset = (template.default_timeframe || '1week') as DurationPreset;
    setDurationPreset(preset);
    const days = DURATION_DAYS[preset] ?? 7;
    const newEnd = new Date();
    newEnd.setDate(newEnd.getDate() + days);
    setEndDate(newEnd);
  }, [templateId, templates]);

  // Computed values
  const durationDays = useMemo(() => {
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  const showDailyOptions =
    durationDays >= 2 && durationDays <= MAX_DAILY_TRACKING_DAYS;

  const pledgeTodos: PledgeTodos = useMemo(
    () => computePledgeTodos(taskDefinitions, startDate, endDate),
    [taskDefinitions, startDate, endDate]
  );

  const isValid = taskDefinitions.length > 0 && parseFloat(stakeAmount) > 0;

  // Task handlers
  const addTaskDefinition = useCallback((def: TaskDefinition) => {
    setTaskDefinitions((prev) => [...prev, def]);
    setTemplateDirty(true);
  }, []);

  const removeTaskDefinition = useCallback((index: number) => {
    setTaskDefinitions((prev) => prev.filter((_, i) => i !== index));
    setTemplateDirty(true);
  }, []);

  // Date handlers
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
      // If daily options become unavailable, convert daily tasks to goals
      if (
        newDurationDays < 2 ||
        newDurationDays > MAX_DAILY_TRACKING_DAYS
      ) {
        setTaskDefinitions((prev) =>
          prev.map((def) =>
            def.schedule !== 'not_daily'
              ? { ...def, schedule: 'not_daily' as const, customDays: undefined }
              : def
          )
        );
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

  // Save as template
  const handleSaveTemplate = useCallback(
    async (templateName: string) => {
      try {
        await createTemplate.mutateAsync({
          name: templateName,
          todos: pledgeTodos,
          task_definitions: taskDefinitions,
          default_timeframe: durationPreset,
        });
        setTemplateDirty(false);
      } catch (err) {
        console.error('Failed to save template:', err);
      }
    },
    [createTemplate, pledgeTodos, taskDefinitions, durationPreset]
  );

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

      // Fallback name: first task text if only one task, otherwise date range
      let pledgeName = name.trim();
      if (!pledgeName) {
        if (taskDefinitions.length === 1) {
          pledgeName = taskDefinitions[0].text;
        } else {
          const fmt = (d: Date) =>
            d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          pledgeName = `${fmt(startDate)} - ${fmt(endDate)}`;
        }
      }

      await createPledgeInDb.mutateAsync({
        on_chain_address: result.pledgeAddress.toString(),
        name: pledgeName,
        timeframe_type: durationPreset,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        deadline: endDate.toISOString(),
        stake_amount: parseUsdcToLamports(stakeAmount),
        todos: pledgeTodos,
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
    taskDefinitions,
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
    stakeAmountSheetRef,
    saveTemplateSheetRef,

    // Computed
    durationDays,
    showDailyOptions,
    pledgeTodos,
    isValid,
    templateDirty,

    // Handlers
    addTaskDefinition,
    removeTaskDefinition,
    handleStartDateConfirm,
    handleDurationConfirm,
    handleRemindersConfirm,
    handleSaveTemplate,
    handleCreate,

    // Labels
    formatDate,
    formatTime,
    getDurationLabel,
    getRemindersLabel,
  };
};
