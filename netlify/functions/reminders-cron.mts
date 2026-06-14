/**
 * Netlify Scheduled Function — fires every 5 minutes.
 * Calls the app's /api/cron/reminders endpoint with the shared secret so it
 * can scan Firestore and send due reminders even when no one has the app open.
 *
 * The schedule is declared inline via `export const config` below.
 */
import type { Config } from '@netlify/functions';

export default async function handler() {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error('[reminders-cron] Missing URL or CRON_SECRET env');
    return new Response('Missing config', { status: 500 });
  }

  try {
    const res = await fetch(`${base}/api/cron/reminders`, {
      method: 'POST',
      headers: { 'x-cron-secret': secret },
    });
    const text = await res.text();
    console.log(`[reminders-cron] ${res.status}: ${text}`);
    return new Response(text, { status: res.status });
  } catch (err) {
    console.error('[reminders-cron] fetch failed:', err);
    return new Response('Error', { status: 500 });
  }
}

export const config: Config = {
  schedule: '*/5 * * * *',
};
