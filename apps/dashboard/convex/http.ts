// apps/dashboard/convex/http.ts
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { WebhookEvent } from '@clerk/backend';
import { Webhook } from 'svix';

const http = httpRouter();

http.route({
  path: '/clerk-users-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) return new Response('Invalid signature', { status: 400 });

    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        await ctx.runMutation(internal.users.upsertFromClerk, { data: event.data });
        break;
      }
      case 'user.deleted': {
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId: event.data.id! });
        break;
      }
      default:
        // ignore other events
        break;
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payload = await req.text();
  const headers = {
    'svix-id': req.headers.get('svix-id')!,
    'svix-timestamp': req.headers.get('svix-timestamp')!,
    'svix-signature': req.headers.get('svix-signature')!,
  };
  try {
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    return wh.verify(payload, headers) as unknown as WebhookEvent;
  } catch (err) {
    console.error('Clerk webhook verify failed', err);
    return null;
  }
}

export default http;
