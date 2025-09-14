import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

http.route({
  path: '/workos-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const bodyText = await request.text();
    const sigHeader = String(request.headers.get('workos-signature'));

    try {
      await ctx.runAction(internal.workos.verifyWebhook, {
        payload: bodyText,
        signature: sigHeader,
      });

      const { data, event } = JSON.parse(bodyText);

      switch (event) {
        case 'user.created': {
          await ctx.runMutation(internal.users.syncFromWorkOS, {
            email: data.email,
            workosUserId: data.id,
            emailVerified: data.email_verified,
            firstName: data.first_name,
            lastName: data.last_name,
            profilePictureUrl: data.profile_picture_url ?? undefined,
          });

          break;
        }

        case 'user.updated': {
          await ctx.runMutation(internal.users.syncFromWorkOS, {
            email: data.email,
            workosUserId: data.id,
            emailVerified: data.email_verified,
            firstName: data.first_name,
            lastName: data.last_name,
            profilePictureUrl: data.profile_picture_url ?? undefined,
          });

          break;
        }

        default: {
          throw new Error(`Unhandled event type: ${event}`);
        }
      }

      return new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('Unhandled event type')) {
          return new Response(
            JSON.stringify({
              status: 'error',
              message: e.message,
            }),
            {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      }

      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }),
});

export default http;
