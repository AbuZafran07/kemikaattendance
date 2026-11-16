export type PushResult = { status: 'sent' | 'unregistered' | 'failed'; httpStatus: number };

// The connector holds the service account and performs the OAuth2 exchange/cache.
// No service-account private key or legacy server key enters application code.
export async function sendFcm(
  token: string, title: string, body: string, data: Record<string, string> = {},
  fetcher: typeof fetch = fetch,
  config = { apiKey: Deno.env.get('LOVABLE_API_KEY'), connectionKey: Deno.env.get('FIREBASE_MESSAGING_API_KEY') },
): Promise<PushResult> {
  if (!config.apiKey || !config.connectionKey) throw new Error('FCM connection is not configured');
  const path = data.path?.startsWith('/employee/') ? data.path : '/employee/notifications';
  const response = await fetcher('https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'X-Connection-Api-Key': config.connectionKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token, notification: { title, body }, data,
      webpush: { fcm_options: { link: `https://kemikaattendance.web.id${path}` }, notification: { tag: data.notification_id || undefined } },
    } }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.ok) return { status: 'sent', httpStatus: response.status };
  const failure = await response.json().catch(() => ({}));
  const codes = failure?.error?.details?.map((d: { errorCode?: string }) => d.errorCode) || [];
  // Never log response bodies: providers can echo device tokens or credentials.
  console.error('FCM delivery rejected', response.status, codes.includes('UNREGISTERED') ? 'UNREGISTERED' : 'provider-error');
  return { status: codes.includes('UNREGISTERED') ? 'unregistered' : 'failed', httpStatus: response.status };
}