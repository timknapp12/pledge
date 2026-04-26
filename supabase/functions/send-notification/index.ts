// Send pending push notifications via Expo Push API
// Triggered by pg_cron every 2 minutes

/// <reference path="../shims.d.ts" />

import { createClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

interface NotificationRow {
  id: string;
  user_id: string;
  pledge_id: string;
  type: string;
  title: string;
  body: string;
  scheduled_for: string;
  push_token: string | null;
  notifications_enabled: boolean;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Only the pg_cron job (or privileged backends) should reach this function.
    // The anon key would otherwise pass the gateway's verify_jwt check.
    if (req.headers.get('Authorization') !== `Bearer ${supabaseServiceKey}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query pending notifications that are due, joined with user for push_token
    const { data: notifications, error: queryError } = await supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        pledge_id,
        type,
        title,
        body,
        scheduled_for,
        users!inner(push_token, notifications_enabled)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error('Query error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query notifications' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, cancelled: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Separate sendable vs non-sendable
    const toSend: Array<NotificationRow & { push_token: string }> = [];
    const toCancelIds: string[] = [];

    for (const n of notifications) {
      const user = (n as any).users;
      const token = user?.push_token;
      const enabled = user?.notifications_enabled;

      if (!token || !enabled) {
        toCancelIds.push(n.id);
      } else {
        toSend.push({ ...n, push_token: token, notifications_enabled: enabled });
      }
    }

    // Cancel notifications for users with no token or disabled
    if (toCancelIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ status: 'cancelled' })
        .in('id', toCancelIds);
    }

    if (toSend.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, cancelled: toCancelIds.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build Expo push messages
    const messages = toSend.map((n) => ({
      to: n.push_token,
      title: n.title,
      body: n.body,
      sound: 'default' as const,
      channelId: 'reminders',
      data: { pledgeId: n.pledge_id, type: n.type },
    }));

    // Send to Expo Push API
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    const tickets: ExpoPushTicket[] = result.data ?? [];

    // Process results
    const sentIds: string[] = [];
    const failedUpdates: Array<{ id: string; error: string }> = [];
    const deviceNotRegisteredUserIds: Set<string> = new Set();

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const notification = toSend[i];

      if (ticket.status === 'ok') {
        sentIds.push(notification.id);
      } else {
        const errorType = ticket.details?.error;
        if (errorType === 'DeviceNotRegistered') {
          deviceNotRegisteredUserIds.add(notification.user_id);
          failedUpdates.push({ id: notification.id, error: 'DeviceNotRegistered' });
        } else {
          failedUpdates.push({
            id: notification.id,
            error: ticket.message || 'Unknown error',
          });
        }
      }
    }

    // Mark sent notifications
    if (sentIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', sentIds);
    }

    // Mark failed notifications
    for (const fail of failedUpdates) {
      await supabase
        .from('notifications')
        .update({ status: 'failed', error_message: fail.error })
        .eq('id', fail.id);
    }

    // Handle DeviceNotRegistered: clear token, disable notifications, cancel pending
    for (const userId of deviceNotRegisteredUserIds) {
      await supabase
        .from('users')
        .update({ push_token: null, notifications_enabled: false })
        .eq('id', userId);

      await supabase
        .from('notifications')
        .update({ status: 'cancelled' })
        .eq('user_id', userId)
        .eq('status', 'pending');
    }

    console.log(
      `Notifications: ${sentIds.length} sent, ${toCancelIds.length} cancelled, ${failedUpdates.length} failed, ${deviceNotRegisteredUserIds.size} tokens invalidated`
    );

    return new Response(
      JSON.stringify({
        sent: sentIds.length,
        cancelled: toCancelIds.length,
        failed: failedUpdates.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
