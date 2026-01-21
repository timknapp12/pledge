// Send push notifications via Expo
// Triggered by pg_cron for deadline reminders and other notifications

/// <reference path="../shims.d.ts" />

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // Query for pledges that need notifications
    // 1. Deadline reminders (based on user preferences)
    // 2. Deadline reached
    // 3. Time to report (after deadline)

    // Get pledges approaching deadline (within 24 hours)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { data: approachingPledges, error: approachingError } = await supabase
      .from('pledges')
      .select('*, users!inner(wallet_address, notification_preferences)')
      .eq('status', 'Active')
      .gte('deadline', now.toISOString())
      .lte('deadline', tomorrow.toISOString());

    if (approachingError) {
      console.error('Error fetching approaching pledges:', approachingError);
    }

    // Get pledges past deadline (need to report)
    const { data: pastDeadlinePledges, error: pastError } = await supabase
      .from('pledges')
      .select('*, users!inner(wallet_address, notification_preferences)')
      .eq('status', 'Active')
      .lt('deadline', now.toISOString());

    if (pastError) {
      console.error('Error fetching past deadline pledges:', pastError);
    }

    const notifications: ExpoPushMessage[] = [];

    // Build notifications for approaching deadlines
    for (const pledge of approachingPledges || []) {
      // TODO: Get expo push token from user profile
      // For now, skip if no push token
      const pushToken = pledge.users?.expo_push_token;
      if (!pushToken) continue;

      const hoursUntilDeadline = Math.round(
        (new Date(pledge.deadline).getTime() - now.getTime()) / (1000 * 60 * 60)
      );

      notifications.push({
        to: pushToken,
        title: 'Pledge Deadline Approaching',
        body: `"${pledge.name}" is due in ${hoursUntilDeadline} hours!`,
        data: { pledgeId: pledge.id, type: 'deadline_reminder' },
        sound: 'default',
      });
    }

    // Build notifications for past deadline (time to report)
    for (const pledge of pastDeadlinePledges || []) {
      const pushToken = pledge.users?.expo_push_token;
      if (!pushToken) continue;

      notifications.push({
        to: pushToken,
        title: 'Time to Report',
        body: `"${pledge.name}" deadline has passed. Submit your completion report!`,
        data: { pledgeId: pledge.id, type: 'time_to_report' },
        sound: 'default',
      });
    }

    // Send notifications via Expo
    if (notifications.length > 0) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notifications),
      });

      const result = await response.json();
      console.log('Expo push result:', result);
    }

    return new Response(
      JSON.stringify({ sent: notifications.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});
