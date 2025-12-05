import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Ycloud-Signature',
};

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

    const webhookData = await req.json();

    console.log('Received webhook event:', webhookData.type);
    console.log('Full webhook data:', JSON.stringify(webhookData, null, 2));

    // Handle different webhook event types based on YCloud structure
    if (webhookData.type === 'whatsapp.inbound_message.received') {
      await handleIncomingMessage(supabase, webhookData);
    } else if (webhookData.type === 'whatsapp.message.updated') {
      await handleStatusUpdate(supabase, webhookData);
    } else if (webhookData.type === 'whatsapp.smb.message.echoes') {
      await handleSMBMessageSync(supabase, webhookData);
    } else if (
      webhookData.type === 'whatsapp.message.sent' ||
      webhookData.type === 'whatsapp.outbound_message.sent'
    ) {
      await handleOutboundMessage(supabase, webhookData);
    } else {
      console.log('Unhandled webhook type:', webhookData.type);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook received',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function handleIncomingMessage(supabase: any, webhookData: any) {
  try {
    const message = webhookData.whatsappInboundMessage;
    if (!message) {
      console.error('No whatsappInboundMessage found in webhook data');
      return;
    }

    const from = message.from;
    const to = message.to;
    const messageId = message.wamid || message.id;
    const timestamp = message.sendTime || new Date().toISOString();

    console.log(`Processing inbound message from ${from} to ${to}`);

    // Determine message type and content
    let messageType = message.type || 'text';
    let content: any = {};
    let lastMessagePreview = 'New message';

    if (message.type === 'text' && message.text) {
      messageType = 'text';
      content = { text: message.text.body };
      lastMessagePreview = message.text.body;
    } else if (message.type === 'image' && message.image) {
      messageType = 'image';
      content = {
        link: message.image.link,
        id: message.image.id,
        mime_type: message.image.mime_type,
        caption: message.image.caption,
      };
      lastMessagePreview = message.image.caption || 'Image';
    } else if (message.type === 'video' && message.video) {
      messageType = 'video';
      content = {
        link: message.video.link,
        id: message.video.id,
        mime_type: message.video.mime_type,
        caption: message.video.caption,
      };
      lastMessagePreview = message.video.caption || 'Video';
    } else if (message.type === 'audio' && message.audio) {
      messageType = 'audio';
      content = {
        link: message.audio.link,
        id: message.audio.id,
        mime_type: message.audio.mime_type,
      };
      lastMessagePreview = 'Audio';
    } else if (message.type === 'document' && message.document) {
      messageType = 'document';
      content = {
        link: message.document.link,
        id: message.document.id,
        mime_type: message.document.mime_type,
        filename: message.document.filename,
        caption: message.document.caption,
      };
      lastMessagePreview = message.document.filename || 'Document';
    } else if (message.type === 'location' && message.location) {
      messageType = 'location';
      content = {
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        name: message.location.name,
        address: message.location.address,
      };
      lastMessagePreview = 'Location';
    } else if (message.type === 'contacts' && message.contacts) {
      messageType = 'contact';
      content = { contacts: message.contacts };
      lastMessagePreview = 'Contact';
    } else if (message.type === 'sticker' && message.sticker) {
      messageType = 'sticker';
      content = {
        link: message.sticker.link,
        id: message.sticker.id,
        mime_type: message.sticker.mime_type,
      };
      lastMessagePreview = 'Sticker';
    } else if (message.type === 'interactive' && message.interactive) {
      messageType = 'interactive';
      content = message.interactive;
      if (message.interactive.list_reply) {
        lastMessagePreview = message.interactive.list_reply.title;
      } else if (message.interactive.button_reply) {
        lastMessagePreview = message.interactive.button_reply.title;
      } else {
        lastMessagePreview = 'Interactive response';
      }
    }

    // Find company_id for the business number
    const { data: businessNumber } = await supabase
        .from('business_numbers')
        .select('company_id')
        .eq('phone_number', to)
        .maybeSingle();
        
    const companyId = businessNumber?.company_id;

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', from)
      .eq('from_number', to)
      .maybeSingle();

    if (!conversation) {
      console.log('Creating new conversation');
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          phone_number: from,
          from_number: to,
          contact_name: message.customerProfile?.name || from,
          last_message: lastMessagePreview,
          last_message_time: timestamp,
          unread_count: 1,
          company_id: companyId, // Link conversation to company
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating conversation:', createError);
        throw createError;
      }
      conversation = newConv;
    } else {
      console.log('Updating existing conversation');
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: lastMessagePreview,
          last_message_time: timestamp,
          unread_count: (conversation.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
          company_id: companyId, // Ensure company_id is consistent
        })
        .eq('id', conversation.id);

      if (updateError) {
        console.error('Error updating conversation:', updateError);
      }
    }

    // Store message in database (ignore if duplicate message_id)
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        message_id: messageId,
        from_number: to,
        direction: 'inbound',
        message_type: messageType,
        content,
        status: 'read',
        timestamp,
        reply_to_message_id: message.context?.id || null,
        context: message.context || null,
      })
      .select()
      .maybeSingle();

    if (msgError && msgError.code !== '23505') {
      console.error('Error inserting message:', msgError);
      throw msgError;
    }

    if (msgError?.code === '23505') {
      console.log('Message already exists, skipping duplicate:', messageId);
    }

    console.log('Successfully processed incoming message:', messageId);
  } catch (error) {
    console.error('Error handling incoming message:', error);
    throw error;
  }
}

async function handleStatusUpdate(supabase: any, webhookData: any) {
  try {
    const message = webhookData.whatsappMessage;
    if (!message) {
      console.error('No whatsappMessage found in status update');
      return;
    }

    const messageId = message.wamid || message.id;
    const newStatus = message.status;

    if (!messageId || !newStatus) {
      console.error('Missing messageId or status');
      return;
    }

    console.log(`Updating message ${messageId} status to ${newStatus}`);

    // Update message status
    const { error } = await supabase
      .from('messages')
      .update({ status: newStatus })
      .eq('message_id', messageId);

    if (error) {
      console.error('Error updating status:', error);
      throw error;
    }

    console.log('Successfully updated message status:', messageId, newStatus);
  } catch (error) {
    console.error('Error handling status update:', error);
    throw error;
  }
}

async function handleSMBMessageSync(supabase: any, webhookData: any) {
  try {
    const message = webhookData.whatsappMessage;
    if (!message) {
      console.error('No whatsappMessage found in SMB sync');
      return;
    }

    const from = message.from;
    const to = message.to;
    const messageId = message.wamid || message.id;
    const timestamp = message.sendTime || new Date().toISOString();

    console.log(`Processing SMB message sync from ${from} to ${to}`);

    // This is a message sent from WhatsApp Business App (not API)
    let messageType = message.type || 'text';
    let content: any = {};
    let lastMessagePreview = 'Message sent';

    if (message.type === 'text' && message.text) {
      messageType = 'text';
      content = { text: message.text.body };
      lastMessagePreview = message.text.body;
    } else if (message.type === 'image' && message.image) {
      messageType = 'image';
      content = message.image;
      lastMessagePreview = 'Image';
    } else if (message.type === 'video' && message.video) {
      messageType = 'video';
      content = message.video;
      lastMessagePreview = 'Video';
    } else if (message.type === 'audio' && message.audio) {
      messageType = 'audio';
      content = message.audio;
      lastMessagePreview = 'Audio';
    } else if (message.type === 'document' && message.document) {
      messageType = 'document';
      content = message.document;
      lastMessagePreview = message.document.filename || 'Document';
    } else if (message.type === 'sticker' && message.sticker) {
      messageType = 'sticker';
      content = message.sticker;
      lastMessagePreview = 'Sticker';
    } else if (message.type === 'location' && message.location) {
      messageType = 'location';
      content = message.location;
      lastMessagePreview = 'Location';
    } else if (message.type === 'contacts' && message.contacts) {
      messageType = 'contact';
      content = { contacts: message.contacts };
      lastMessagePreview = 'Contact';
    } else if (message.type === 'interactive' && message.interactive) {
      messageType = 'interactive';
      content = message.interactive;
      if (message.interactive.list_reply) {
        lastMessagePreview = message.interactive.list_reply.title;
      } else if (message.interactive.button_reply) {
        lastMessagePreview = message.interactive.button_reply.title;
      } else {
        lastMessagePreview = 'Interactive message';
      }
    } else if (message.type === 'template' && message.template) {
      messageType = 'template';
      content = message.template;
      lastMessagePreview = 'Template message';
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', to)
      .eq('from_number', from)
      .maybeSingle();

    if (!conversation) {
      console.log('Creating new conversation for SMB sync');
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          phone_number: to,
          from_number: from,
          contact_name: to,
          last_message: lastMessagePreview,
          last_message_time: timestamp,
          unread_count: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating conversation:', createError);
        throw createError;
      }
      conversation = newConv;
    } else {
      console.log('Updating existing conversation for SMB sync');
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: lastMessagePreview,
          last_message_time: timestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

      if (updateError) {
        console.error('Error updating conversation:', updateError);
      }
    }

    // Store message in database (ignore if duplicate message_id)
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        message_id: messageId,
        from_number: from,
        direction: 'outbound',
        message_type: messageType,
        content,
        status: message.status || 'sent',
        timestamp,
      })
      .select()
      .maybeSingle();

    if (msgError && msgError.code !== '23505') {
      console.error('Error inserting SMB sync message:', msgError);
      throw msgError;
    }

    if (msgError?.code === '23505') {
      console.log('SMB message already exists, skipping duplicate:', messageId);
    }

    console.log('Successfully processed SMB message sync:', messageId);
  } catch (error) {
    console.error('Error handling SMB message sync:', error);
    throw error;
  }
}

async function handleOutboundMessage(supabase: any, webhookData: any) {
  try {
    const message = webhookData.whatsappMessage;
    if (!message) {
      console.error('No whatsappMessage found in outbound event');
      return;
    }

    const from = message.from; // business number
    const to = message.to; // customer number
    const messageId = message.wamid || message.id;
    const timestamp = message.sendTime || new Date().toISOString();

    let messageType = message.type || 'text';
    let content: any = {};
    let lastMessagePreview = 'Message sent';

    if (message.type === 'text' && message.text) {
      messageType = 'text';
      content = { text: message.text.body };
      lastMessagePreview = message.text.body;
    } else if (message.type === 'image' && message.image) {
      messageType = 'image';
      content = message.image;
      lastMessagePreview = 'Image';
    } else if (message.type === 'video' && message.video) {
      messageType = 'video';
      content = message.video;
      lastMessagePreview = 'Video';
    } else if (message.type === 'audio' && message.audio) {
      messageType = 'audio';
      content = message.audio;
      lastMessagePreview = 'Audio';
    } else if (message.type === 'document' && message.document) {
      messageType = 'document';
      content = message.document;
      lastMessagePreview = message.document.filename || 'Document';
    } else if (message.type === 'sticker' && message.sticker) {
      messageType = 'sticker';
      content = message.sticker;
      lastMessagePreview = 'Sticker';
    } else if (message.type === 'location' && message.location) {
      messageType = 'location';
      content = message.location;
      lastMessagePreview = 'Location';
    } else if (message.type === 'contacts' && message.contacts) {
      messageType = 'contact';
      content = { contacts: message.contacts };
      lastMessagePreview = 'Contact';
    } else if (message.type === 'interactive' && message.interactive) {
      messageType = 'interactive';
      content = message.interactive;
      if (message.interactive.list_reply) {
        lastMessagePreview = message.interactive.list_reply.title;
      } else if (message.interactive.button_reply) {
        lastMessagePreview = message.interactive.button_reply.title;
      } else {
        lastMessagePreview = 'Interactive message';
      }
    } else if (message.type === 'template' && message.template) {
      messageType = 'template';
      content = message.template;
      lastMessagePreview = 'Template message';
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', to)
      .eq('from_number', from)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          phone_number: to,
          from_number: from,
          contact_name: to,
          last_message: lastMessagePreview,
          last_message_time: timestamp,
          unread_count: 0,
        })
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConv;
    } else {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: lastMessagePreview,
          last_message_time: timestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

      if (updateError) console.error('Error updating conversation:', updateError);
    }

    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        message_id: messageId,
        from_number: from,
        direction: 'outbound',
        message_type: messageType,
        content,
        status: message.status || 'sent',
        timestamp,
      })
      .select()
      .maybeSingle();

    if (msgError && msgError.code !== '23505') {
      console.error('Error inserting outbound message:', msgError);
      throw msgError;
    }

    if (msgError?.code === '23505') {
      console.log('Outbound message already exists, skipping duplicate:', messageId);
    }
  } catch (error) {
    console.error('Error handling outbound message:', error);
    throw error;
  }
}
