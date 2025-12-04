import { supabase } from './supabase';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-api`;

interface SendMessageParams {
  action: 'send_text' | 'send_media' | 'send_template' | 'send_interactive' | 'send_location' | 'send_contact' | 'send_reaction';
  from: string;
  to: string;
  data: any;
}

export async function sendWhatsAppMessage(params: SendMessageParams) {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(params),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to send message');
  }

  return result;
}

export async function getDefaultBusinessNumber(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('business_numbers')
      .select('phone_number')
      .eq('is_default', true)
      .maybeSingle();

    if (error) throw error;
    return data?.phone_number || null;
  } catch (error) {
    console.error('Error getting default business number:', error);
    return null;
  }
}

export async function sendTextMessage(
  from: string,
  to: string,
  text: string,
  previewUrl: boolean = false,
  context?: { message_id: string }
) {
  return sendWhatsAppMessage({
    action: 'send_text',
    from,
    to,
    data: { text, preview_url: previewUrl, context },
  });
}

export async function sendMediaMessage(
  from: string,
  to: string,
  type: 'image' | 'video' | 'audio' | 'document',
  link: string,
  caption?: string
) {
  return sendWhatsAppMessage({
    action: 'send_media',
    from,
    to,
    data: { type, link, caption },
  });
}

export async function sendTemplateMessage(
  from: string,
  to: string,
  name: string,
  language: string,
  components: any[]
) {
  return sendWhatsAppMessage({
    action: 'send_template',
    from,
    to,
    data: { name, language, components },
  });
}

export async function sendInteractiveMessage(
  from: string,
  to: string,
  interactiveType: 'button' | 'list' | 'cta_url' | 'location_request_message',
  bodyText: string,
  action: any,
  header?: any,
  footer?: string
) {
  return sendWhatsAppMessage({
    action: 'send_interactive',
    from,
    to,
    data: {
      interactive_type: interactiveType,
      body_text: bodyText,
      action,
      header,
      footer,
    },
  });
}

export async function sendLocationMessage(
  from: string,
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string
) {
  return sendWhatsAppMessage({
    action: 'send_location',
    from,
    to,
    data: { latitude, longitude, name, address },
  });
}

export async function sendContactMessage(from: string, to: string, contacts: any[]) {
  return sendWhatsAppMessage({
    action: 'send_contact',
    from,
    to,
    data: { contacts },
  });
}

export async function sendReactionMessage(
  from: string,
  to: string,
  messageId: string,
  emoji: string
) {
  return sendWhatsAppMessage({
    action: 'send_reaction',
    from,
    to,
    data: { message_id: messageId, emoji },
  });
}
