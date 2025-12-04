import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
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

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    // Read the audio file
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type });

    // For now, we'll upload as-is but with a better approach:
    // We'll use FFmpeg via a Web API or just recommend OGG with Opus
    // Since Deno doesn't have native audio conversion, we'll accept OGG
    // and return the file URL

    // WhatsApp supports: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg (opus)
    // The browser MediaRecorder can produce audio/ogg with opus codec
    
    const fileName = `audio_${Date.now()}.ogg`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, audioBlob, {
        contentType: 'audio/ogg',
        cacheControl: '3600',
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uploadData.path);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        fileName: uploadData.path,
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
