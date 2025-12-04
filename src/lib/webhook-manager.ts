const WEBHOOK_MANAGER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ycloud-webhook-manager`;

export interface WebhookEndpoint {
  id: string;
  url: string;
  enabledEvents: string[];
  description?: string;
  status: 'enabled' | 'disabled';
  secret?: string;
  createTime?: string;
  updateTime?: string;
}

export async function listWebhooks(apiKey: string): Promise<WebhookEndpoint[]> {
  const response = await fetch(`${WEBHOOK_MANAGER_URL}/list`, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to list webhooks');
  }

  return result.items || [];
}

export async function createWebhook(
  apiKey: string,
  url: string,
  events?: string[]
): Promise<WebhookEndpoint> {
  const response = await fetch(`${WEBHOOK_MANAGER_URL}/create`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      enabledEvents: events || [
        'whatsapp.inbound_message.received',
        'whatsapp.message.updated',
        'whatsapp.smb.message.echoes',
      ],
      description: 'WhatsApp Business webhook',
      status: 'active',
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to create webhook');
  }

  return result;
}

export async function updateWebhook(
  apiKey: string,
  webhookId: string,
  updates: Partial<WebhookEndpoint>
): Promise<WebhookEndpoint> {
  const response = await fetch(`${WEBHOOK_MANAGER_URL}/update`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: webhookId,
      ...updates,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to update webhook');
  }

  return result;
}

export async function deleteWebhook(apiKey: string, webhookId: string): Promise<void> {
  const response = await fetch(`${WEBHOOK_MANAGER_URL}/delete`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: webhookId,
    }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to delete webhook');
  }
}

export function getWebhookUrl(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
}
