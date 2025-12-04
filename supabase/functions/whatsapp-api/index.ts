import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const YCLOUD_API_URL = 'https://api.ycloud.com/v2/whatsapp/messages';

interface SendMessageRequest {
  action: 'send_text' | 'send_media' | 'send_template' | 'send_interactive' | 'send_location' | 'send_contact' | 'send_reaction';
  from: string;
  to: string;
  data: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, from, to, data }: SendMessageRequest = await req.json();

    if (!from) {
      throw new Error('from_number is required');
    }

    // Get the user_id who owns this business number
    const { data: businessNumber, error: numberError } = await supabase
      .from('business_numbers')
      .select('user_id')
      .eq('phone_number', from)
      .maybeSingle();

    if (numberError || !businessNumber) {
      throw new Error('Business number not found');
    }

    // Get the API key for this user
    const { data: apiSettings, error: apiError } = await supabase
      .from('api_settings')
      .select('ycloud_api_key')
      .eq('user_id', businessNumber.user_id)
      .maybeSingle();

    if (apiError || !apiSettings) {
      throw new Error('API key not configured for this number');
    }

    const YCLOUD_API_KEY = apiSettings.ycloud_api_key;

    let yCloudPayload: any = {
      from,
    };
    let messageType = 'text';

    switch (action) {
      case 'send_text':
        yCloudPayload = {
          ...yCloudPayload,
          to,
          type: 'text',
          text: {
            body: data.text,
            preview_url: data.preview_url || false,
          },
          ...(data.context && { context: data.context }),
        };
        messageType = 'text';
        break;

      case 'send_media':
        const mediaType = data.type; // 'image', 'video', 'audio', 'document'
        yCloudPayload = {
          ...yCloudPayload,
          to,
          type: mediaType,
          [mediaType]: mediaType === 'audio'
            ? { link: data.link }
            : {
                link: data.link,
                caption: data.caption || '',
              },
        };
        messageType = mediaType;
        break;

      case 'send_template':
        yCloudPayload = {
          ...yCloudPayload,
          to,
          type: 'template',
          template: {
            name: data.name,
            language: {
              code: data.language || 'en',
            },
            components: data.components || [],
          },
        };
        messageType = 'template';
        break;

      case 'send_interactive':
        const interactiveType = data.interactive_type; // 'button', 'list', 'cta_url', 'location_request_message'
        yCloudPayload = {
          ...yCloudPayload,
          to,
          type: 'interactive',
          interactive: {
            type: interactiveType,
            body: {
              text: data.body_text,
            },
            ...(data.header && { header: data.header }),
            ...(data.footer && { footer: { text: data.footer } }),
            action: data.action,
          },
        };
        messageType = 'interactive';
        break;

      case 'send_location':
        yCloudPayload = {
          ...yCloudPayload,
          to,
          type: 'location',
          location: {
            latitude: data.latitude,
            longitude: data.longitude,
            name: data.name || '',
            address: data.address || '',
          },
        };
        messageType = 'location';
        break;

      case 'send_contact':
        yCloudPayload = {
          ...yCloudPayload,
          to,
          type: 'contacts',
          contacts: data.contacts,
        };
        messageType = 'contact';
        break;

      case 'send_reaction':
        // Validate that message_id starts with 'wamid.'
        if (!data.message_id || !data.message_id.startsWith('wamid.')) {
          throw new Error('Invalid WhatsApp message ID. Must start with "wamid."');
        }
        yCloudPayload = {
          ...yCloudPayload,
          to,
          type: 'reaction',
          reaction: {
            message_id: data.message_id,
            emoji: data.emoji,
          },
        };
        messageType = 'reaction';
        break;

      default:
        throw new Error('Invalid action');
    }

    // Send message to YCloud
    const yCloudResponse = await fetch(`${YCLOUD_API_URL}/sendDirectly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': YCLOUD_API_KEY,
      },
      body: JSON.stringify(yCloudPayload),
    });

    const yCloudResult = await yCloudResponse.json();

    if (!yCloudResponse.ok) {
      throw new Error(yCloudResult.message || 'Failed to send message');
    }

    // Find or create conversation (skip for reactions)
    let conversation;
    if (action !== 'send_reaction') {
      let { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('phone_number', to)
        .eq('from_number', from)
        .maybeSingle();

      if (!conv) {
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            phone_number: to,
            from_number: from,
            contact_name: to,
            last_message: data.text || 'Media message',
            last_message_time: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;
        conversation = newConv;
      } else {
        // Update conversation
        let lastMessage = data.text || 'Media message';
        if (action === 'send_interactive') {
          if (data.interactive_type === 'location_request_message') {
            lastMessage = 'Location request';
          } else if (data.interactive_type === 'cta_url') {
            lastMessage = 'Interactive message';
          } else {
            lastMessage = data.body_text || 'Interactive message';
          }
        }

        await supabase
          .from('conversations')
          .update({
            last_message: lastMessage,
            last_message_time: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conv.id);
        conversation = conv;
      }
    } else {
      // For reactions, just find the conversation (don't create or update)
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('phone_number', to)
        .eq('from_number', from)
        .maybeSingle();

      if (convError || !conv) {
        throw new Error('Conversation not found for reaction');
      }
      conversation = conv;
    }

    // Store message in database
    // For interactive messages, store the nested structure
    let contentToStore = data;
    if (action === 'send_interactive') {
      contentToStore = {
        interactive: {
          type: data.interactive_type,
          body: {
            text: data.body_text,
          },
          ...(data.header && { header: data.header }),
          ...(data.footer && { footer: { text: data.footer } }),
          action: data.action,
        },
      };
    }

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        message_id: yCloudResult.id,
        from_number: from,
        direction: 'outbound',
        message_type: messageType,
        content: contentToStore,
        status: 'sent',
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgError) throw msgError;

    return new Response(
      JSON.stringify({
        success: true,
        message,
        ycloud_response: yCloudResult,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
