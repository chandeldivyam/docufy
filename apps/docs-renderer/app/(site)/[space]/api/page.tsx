import { APIPage } from 'fumadocs-openapi/ui';
import { openapi } from '../../../../lib/openapi';

export const runtime = 'nodejs';

export default async function ApiPlayground() {
  return (
    <div className="fd-scope pt-5" >
      <APIPage {...openapi.getAPIPageProps({
        document: 'https://zeus-api.atlas.so/openapi.json',
        operations: [
          { path: '/v1/webhooks/{integration_id}/message-received', method: 'post' },
        ],
        hasHead: true,
      })} />
    </div>
  );
}
