const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const YCLOUD_API_BASE = 'https://api.ycloud.com/v2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // Get API key from request header
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'X-API-Key header is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Route handlers
    if (path.includes('/list') && req.method === 'GET') {
      return await listWebhooks(apiKey);
    } else if (path.includes('/create') && req.method === 'POST') {
      const body = await req.json();
      return await createWebhook(apiKey, body);
    } else if (path.includes('/update') && req.method === 'POST') {
      const body = await req.json();
      return await updateWebhook(apiKey, body);
    } else if (path.includes('/delete') && req.method === 'POST') {
      const body = await req.json();
      return await deleteWebhook(apiKey, body.id);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Webhook manager error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function listWebhooks(apiKey: string) {
  try {
    const response = await fetch(`${YCLOUD_API_BASE}/webhookEndpoints`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(`Failed to list webhooks: ${error.message}`);
  }
}

async function createWebhook(apiKey: string, config: any) {
  try {
    const response = await fetch(`${YCLOUD_API_BASE}/webhookEndpoints`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: config.url,
        enabledEvents: config.enabledEvents || [
          'whatsapp.inbound_message.received',
          'whatsapp.message.updated',
          'whatsapp.smb.message.echoes',
        ],
        description: config.description || 'WhatsApp webhook endpoint',
        status: config.status || 'enabled',
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(`Failed to create webhook: ${error.message}`);
  }
}

async function updateWebhook(apiKey: string, config: any) {
  try {
    if (!config.id) {
      throw new Error('Webhook ID is required for update');
    }

    const updateData: any = {};
    if (config.url) updateData.url = config.url;
    if (config.enabledEvents) updateData.enabledEvents = config.enabledEvents;
    if (config.description) updateData.description = config.description;
    if (config.status) updateData.status = config.status;

    const response = await fetch(
      `${YCLOUD_API_BASE}/webhookEndpoints/${config.id}`,
      {
        method: 'PATCH',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(`Failed to update webhook: ${error.message}`);
  }
}

async function deleteWebhook(apiKey: string, webhookId: string) {
  try {
    if (!webhookId) {
      throw new Error('Webhook ID is required for deletion');
    }

    const response = await fetch(
      `${YCLOUD_API_BASE}/webhookEndpoints/${webhookId}`,
      {
        method: 'DELETE',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.status === 204 ? { success: true } : await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }
}