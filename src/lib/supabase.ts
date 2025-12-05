import { createClient } from '@supabase/supabase-js';

// Dynamic URL resolution for Docker/VPS environments
// If VITE_SUPABASE_URL is not set or is relative, use the current origin + /api
const getSupabaseUrl = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl;
  }
  return `${window.location.origin}/api`;
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'whatsapp-auth',
  },
});

export interface Conversation {
  id: string;
  phone_number: string;
  from_number: string | null;
  business_number_id: string | null;
  contact_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  message_id: string | null;
  from_number: string | null;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template' | 'interactive' | 'location' | 'contact' | 'sticker';
  content: any;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  timestamp: string;
  created_at: string;
  reply_to_message_id?: string | null;
  context?: {
    from?: string;
    id?: string;
    text?: string;
    type?: string;
  } | null;
  isPending?: boolean;
  tempId?: string;
}

export interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  content: any;
  created_at: string;
}

export interface BusinessNumber {
  id: string;
  phone_number: string;
  display_name: string;
  is_default: boolean;
  user_id: string | null;
  company_id: string | null;
  status: 'pending' | 'active' | 'rejected';
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  subscription_status: 'active' | 'locked' | 'past_due';
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'superadmin' | 'admin' | 'worker';
  status: 'active' | 'inactive';
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiSettings {
  id: string;
  user_id: string | null;
  company_id: string | null;
  ycloud_api_key: string;
  webhook_secret: string | null;
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface QuickReply {
  id: string;
  user_id: string;
  company_id: string | null;
  shortcut: string;
  message: string | null;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
  media_url: string | null;
  caption: string | null;
  created_at: string;
  updated_at: string;
}
