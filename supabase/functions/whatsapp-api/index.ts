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

export const whatsappApiHandler = async (req: Request) => {
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

    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // 2. Get User Profile and Company Status
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, company_id, companies(subscription_status)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error('User profile not found');
    }

    const isSuperAdmin = userProfile.role === 'superadmin';
    // Optional chaining is safe here because companies might be null if user has no company
    // But enforced by business logic usually.
    const subscriptionStatus = userProfile.companies?.subscription_status;
    const isLocked = subscriptionStatus === 'locked' || subscriptionStatus === 'past_due';

    // 3. Check Subscription Status (Block if locked, unless Superadmin)
    if (isLocked && !isSuperAdmin) {
      throw new Error('Company subscription is locked. Cannot send messages.');
    }

    const { action, from, to, data }: SendMessageRequest = await req.json();

    if (!from) {
      throw new Error('from_number is required');
    }

    // 4. Verify Business Number Ownership
    const { data: businessNumber, error: numberError } = await supabase
      .from('business_numbers')
      .select('user_id, company_id')
      .eq('phone_number', from)
      .maybeSingle();

    if (numberError || !businessNumber) {
      throw new Error('Business number not found');
    }

    // Check permissions
    // If user is not superadmin, they must belong to the same company as the business number
    if (!isSuperAdmin) {
      if (!userProfile.company_id || userProfile.company_id !== businessNumber.company_id) {
        throw new Error('You do not have permission to use this business number');
      }
    }

    // 5. Get the API key for this company
    // Prefer company_id lookup
    let apiKeyQuery = supabase
      .from('api_settings')
      .select('ycloud_api_key');
    
    if (businessNumber.company_id) {
        apiKeyQuery = apiKeyQuery.eq('company_id', businessNumber.company_id);
    } else if (businessNumber.user_id) {
        // Fallback for legacy data
        apiKeyQuery = apiKeyQuery.eq('user_id', businessNumber.user_id);
    } else {
        throw new Error('Business number is not linked to any company or user');
    }

    const { data: apiSettings, error: apiError } = await apiKeyQuery.maybeSingle();

    if (apiError || !apiSettings || !apiSettings.ycloud_api_key) {
      throw new Error('API key not configured for this company');
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
            company_id: businessNumber.company_id, // Ensure conversation is linked to company
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
            company_id: businessNumber.company_id, // Ensure company_id is set/updated
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
        company_id: businessNumber.company_id, // Ensure message is linked to company
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
};
