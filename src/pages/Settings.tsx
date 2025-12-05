import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Users, Bell, MessageSquare, Edit2, Upload, X, Image as ImageIcon, Video, FileText, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, BusinessNumber, ApiSettings, QuickReply } from '../lib/supabase';
import { requestNotificationPermission } from '../lib/notifications';

interface SettingsProps {
  onBack: () => void;
  onNavigateToUsers?: () => void;
}

export default function Settings({ onBack, onNavigateToUsers }: SettingsProps) {
  const { user, isSuperAdmin, isAdmin, isWorker, company } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [numbers, setNumbers] = useState<BusinessNumber[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [newNumberName, setNewNumberName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(Notification.permission);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [newQuickReply, setNewQuickReply] = useState({
    shortcut: '',
    message: '',
    message_type: 'text' as const,
    media_url: null as string | null,
    caption: ''
  });
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Computed webhook URL based on current location
  // Ensure /api prefix is included for correct routing through Nginx/Kong
  const webhookUrl = `${window.location.origin}/api/functions/v1/whatsapp-webhook`;

  useEffect(() => {
    loadSettings();
    loadNumbers();
    loadQuickReplies();
  }, [user, company]);

  async function loadSettings() {
    if (!company) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('api_settings')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setApiKey(data.ycloud_api_key);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadNumbers() {
    if (!company) return;
    try {
      const { data, error } = await supabase
        .from('business_numbers')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at');

      if (error) throw error;
      setNumbers(data || []);
    } catch (error) {
      console.error('Error loading numbers:', error);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('api_settings')
        .upsert({
          user_id: user!.id,
          company_id: company.id,
          ycloud_api_key: apiKey,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' });

      if (error) throw error;
      alert('Settings saved successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      alert('Webhook URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy URL. Please copy it manually.');
    }
  }

  async function handleAddNumber() {
    if (!newNumber.trim() || !newNumberName.trim()) {
      alert('Please enter both phone number and display name');
      return;
    }

    if (!company) {
      alert('No company associated with this account');
      return;
    }

    try {
      const { error } = await supabase.from('business_numbers').insert({
        phone_number: newNumber.trim(),
        display_name: newNumberName.trim(),
        user_id: user!.id,
        company_id: company.id,
        is_default: numbers.length === 0,
      });

      if (error) throw error;

      setNewNumber('');
      setNewNumberName('');
      loadNumbers();
    } catch (error: any) {
      alert(error.message || 'Failed to add number');
    }
  }

  async function handleDeleteNumber(id: string) {
    if (!confirm('Are you sure you want to delete this number?')) return;

    try {
      const { error } = await supabase
        .from('business_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadNumbers();
    } catch (error: any) {
      alert(error.message || 'Failed to delete number');
    }
  }

  async function loadQuickReplies() {
    if (!company) return;
    try {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('company_id', company.id)
        .order('shortcut');

      if (error) throw error;
      setQuickReplies(data || []);
    } catch (error) {
      console.error('Error loading quick replies:', error);
    }
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 16MB');
      return;
    }

    setUploadingMedia(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const mediaType = file.type.startsWith('image/') ? 'image' :
                       file.type.startsWith('video/') ? 'video' :
                       file.type.startsWith('audio/') ? 'audio' : 'document';

      setNewQuickReply(prev => ({
        ...prev,
        message_type: mediaType as any,
        media_url: urlData.publicUrl,
      }));
      setMediaPreview(urlData.publicUrl);
    } catch (error: any) {
      console.error('Error uploading media:', error);
      alert(error.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  }

  function clearMedia() {
    setNewQuickReply(prev => ({
      ...prev,
      message_type: 'text',
      media_url: null,
      caption: ''
    }));
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleAddQuickReply() {
    if (!newQuickReply.shortcut.trim()) {
      alert('Please enter a shortcut');
      return;
    }

    if (newQuickReply.message_type === 'text' && !newQuickReply.message.trim()) {
      alert('Please enter a message');
      return;
    }

    if (newQuickReply.message_type !== 'text' && !newQuickReply.media_url) {
      alert('Please upload media');
      return;
    }

    if (!company) {
      alert('No company associated with this account');
      return;
    }

    try {
      const { error } = await supabase
        .from('quick_replies')
        .insert({
          user_id: user!.id,
          company_id: company.id,
          shortcut: newQuickReply.shortcut.trim().toLowerCase(),
          message: newQuickReply.message_type === 'text' ? newQuickReply.message.trim() : null,
          message_type: newQuickReply.message_type,
          media_url: newQuickReply.media_url,
          caption: newQuickReply.caption?.trim() || null,
        });

      if (error) throw error;
      setNewQuickReply({
        shortcut: '',
        message: '',
        message_type: 'text',
        media_url: null,
        caption: ''
      });
      setMediaPreview(null);
      loadQuickReplies();
    } catch (error: any) {
      alert(error.message || 'Failed to add quick reply');
    }
  }

  async function handleUpdateQuickReply() {
    if (!editingQuickReply || !editingQuickReply.message.trim()) {
      return;
    }

    try {
      const { error } = await supabase
        .from('quick_replies')
        .update({
          message: editingQuickReply.message.trim(),
        })
        .eq('id', editingQuickReply.id);

      if (error) throw error;
      setEditingQuickReply(null);
      loadQuickReplies();
    } catch (error: any) {
      alert(error.message || 'Failed to update quick reply');
    }
  }

  async function handleDeleteQuickReply(id: string) {
    if (!confirm('Delete this quick reply?')) return;

    try {
      const { error } = await supabase
        .from('quick_replies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadQuickReplies();
    } catch (error: any) {
      alert(error.message || 'Failed to delete quick reply');
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (isWorker) {
    return (
      <div className="flex-1 flex flex-col bg-white w-full">
        <div className="bg-[#008069] md:bg-[#f0f2f5] border-b border-gray-200 px-3 md:px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#017561] md:hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white md:text-gray-700" />
            </button>
            <h1 className="text-lg md:text-xl font-semibold text-white md:text-gray-900">Settings</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600">
              Worker accounts do not have permission to modify settings. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white w-full">
      <div className="bg-[#008069] md:bg-[#f0f2f5] border-b border-gray-200 px-3 md:px-4 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#017561] md:hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white md:text-gray-700" />
          </button>
          <h1 className="text-lg md:text-xl font-semibold text-white md:text-gray-900">Settings</h1>
        </div>
        {(isSuperAdmin || isAdmin) && onNavigateToUsers && (
          <button
            onClick={onNavigateToUsers}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Users className="w-4 h-4" />
            User Management
          </button>
        )}
        {(isSuperAdmin || isAdmin) && onNavigateToUsers && (
          <button
            onClick={onNavigateToUsers}
            className="md:hidden p-2 hover:bg-[#017561] rounded-full transition-colors"
          >
            <Users className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">YCloud API Configuration</h2>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key *
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your YCloud API key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://app.ycloud.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline"
                  >
                    YCloud Dashboard
                  </a>
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">YCloud Webhook Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook Listener URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                  <button
                    onClick={copyWebhookUrl}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Copy this URL and paste it into your YCloud Dashboard under Webhook settings.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 font-medium">Browser Notifications</p>
                <p className="text-xs text-gray-500 mt-1">
                  {notificationStatus === 'granted'
                    ? 'Enabled - You will receive notifications for new messages'
                    : notificationStatus === 'denied'
                    ? 'Blocked - Please enable in browser settings'
                    : 'Get notified when you receive new messages'}
                </p>
              </div>
              {notificationStatus !== 'granted' && (
                <button
                  onClick={async () => {
                    const granted = await requestNotificationPermission();
                    setNotificationStatus(granted ? 'granted' : Notification.permission);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Bell className="w-4 h-4" />
                  Enable
                </button>
              )}
              {notificationStatus === 'granted' && (
                <div className="flex items-center gap-2 text-green-600">
                  <Bell className="w-5 h-5" />
                  <span className="text-sm font-medium">Active</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">WhatsApp Business Numbers</h2>

            <div className="space-y-4 mb-6">
              {numbers.map((number) => (
                <div
                  key={number.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <p className="font-medium text-gray-900">{number.display_name}</p>
                    <p className="text-sm text-gray-600">{number.phone_number}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteNumber(number.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Delete number"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {numbers.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No numbers added yet. Add your first WhatsApp Business number below.
                </p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Number</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="Phone number (e.g., +1234567890)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="text"
                  value={newNumberName}
                  onChange={(e) => setNewNumberName(e.target.value)}
                  placeholder="Display name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleAddNumber}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Quick Replies
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Create shortcuts that you can quickly access by typing "/" in the message box
            </p>

            <div className="space-y-3 mb-6">
              {quickReplies.map((reply) => (
                <div
                  key={reply.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  {editingQuickReply?.id === reply.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">/{reply.shortcut}</span>
                      </div>
                      <textarea
                        value={editingQuickReply.message}
                        onChange={(e) => setEditingQuickReply({ ...editingQuickReply, message: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateQuickReply}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingQuickReply(null)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-mono font-semibold text-green-600">/{reply.shortcut}</span>
                          {reply.message_type !== 'text' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                              {reply.message_type === 'image' && <ImageIcon className="w-3 h-3" />}
                              {reply.message_type === 'video' && <Video className="w-3 h-3" />}
                              {reply.message_type === 'document' && <FileText className="w-3 h-3" />}
                              {reply.message_type}
                            </span>
                          )}
                        </div>

                        {reply.message_type === 'text' ? (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                        ) : (
                          <div className="space-y-2">
                            {reply.message_type === 'image' && (
                              <img
                                src={reply.media_url!}
                                alt="Preview"
                                className="max-w-xs rounded-lg border border-gray-300"
                              />
                            )}
                            {reply.message_type === 'video' && (
                              <video
                                src={reply.media_url!}
                                controls
                                className="max-w-xs rounded-lg border border-gray-300"
                              />
                            )}
                            {reply.caption && (
                              <p className="text-sm text-gray-700 italic">{reply.caption}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingQuickReply(reply)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuickReply(reply.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {quickReplies.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No quick replies yet. Create your first one below.
                </p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={handleMediaUpload}
                className="hidden"
              />

              <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Quick Reply</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        clearMedia();
                        setNewQuickReply(prev => ({ ...prev, message_type: 'text' }));
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${
                        newQuickReply.message_type === 'text'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Text
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingMedia}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${
                        newQuickReply.message_type !== 'text'
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      {uploadingMedia ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Media
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Shortcut (without /)</label>
                  <input
                    type="text"
                    value={newQuickReply.shortcut}
                    onChange={(e) => setNewQuickReply({ ...newQuickReply, shortcut: e.target.value })}
                    placeholder="e.g., hello, thanks, info"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    maxLength={50}
                  />
                </div>

                {newQuickReply.message_type === 'text' ? (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Message</label>
                    <textarea
                      value={newQuickReply.message}
                      onChange={(e) => setNewQuickReply({ ...newQuickReply, message: e.target.value })}
                      placeholder="Enter the message text..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      rows={3}
                      maxLength={4096}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mediaPreview ? (
                      <div className="relative border border-gray-300 rounded-lg p-3 bg-gray-50">
                        <button
                          onClick={clearMedia}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {newQuickReply.message_type === 'image' && (
                          <img src={mediaPreview} alt="Preview" className="max-w-full rounded" />
                        )}
                        {newQuickReply.message_type === 'video' && (
                          /youtube\.com|youtu\.be|instagram\.com/.test(mediaPreview || '') || !/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(mediaPreview || '') ? (
                            <a
                              href={mediaPreview || ''}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              Open video
                            </a>
                          ) : (
                            <video src={mediaPreview || ''} controls className="max-w-full rounded" crossOrigin="anonymous" />
                          )
                        )}
                        {newQuickReply.message_type === 'document' && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <FileText className="w-8 h-8" />
                            <span className="text-sm">Document uploaded</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Click "Media" button above to upload</p>
                    )}

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Caption (Optional)</label>
                      <textarea
                        value={newQuickReply.caption}
                        onChange={(e) => setNewQuickReply({ ...newQuickReply, caption: e.target.value })}
                        placeholder="Add a caption for the media..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        rows={2}
                        maxLength={1024}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAddQuickReply}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Quick Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
