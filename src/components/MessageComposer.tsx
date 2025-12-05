import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Image, FileText, MapPin, User, List, CircleDot, FileCode, Mic, StopCircle, Upload, X, Lock, AlertCircle, Video } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import { Conversation, Message, QuickReply, supabase } from '../lib/supabase';
import {
  sendTextMessage,
  sendMediaMessage,
  sendInteractiveMessage,
  sendLocationMessage,
  sendContactMessage,
  getDefaultBusinessNumber,
} from '../lib/whatsapp-api';
import MediaModal from './MediaModal';
import InteractiveModal from './InteractiveModal';
import LocationModal from './LocationModal';
import ContactModal from './ContactModal';
import TemplateModal from './TemplateModal';
import { useAuth } from '../contexts/AuthContext';

interface MessageComposerProps {
  conversation: Conversation;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  messages?: Message[];
  onOptimisticMessage?: (messageData: Partial<Message>) => void;
}

export default function MessageComposer({ conversation, replyingTo, onCancelReply, messages = [], onOptimisticMessage }: MessageComposerProps) {
  const { user, isCompanyLocked } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadQuickReplies();
  }, [user]);

  async function loadQuickReplies() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('user_id', user.id)
        .order('shortcut');

      if (error) throw error;
      setQuickReplies(data || []);
    } catch (error) {
      console.error('Error loading quick replies:', error);
    }
  }

  async function getFromNumber(): Promise<string> {
    if (conversation.from_number) {
      return conversation.from_number;
    }

    const defaultNumber = await getDefaultBusinessNumber();
    if (!defaultNumber) {
      throw new Error('No business number configured. Please add a number in settings.');
    }
    return defaultNumber;
  }

  async function handleSendText() {
    if (!message.trim()) return;

    const messageText = message.trim();
    const context = replyingTo?.message_id ? { message_id: replyingTo.message_id } : undefined;

    // Clear UI immediately
    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (onCancelReply) {
      onCancelReply();
    }

    // Add optimistic message
    if (onOptimisticMessage) {
      console.log('Calling onOptimisticMessage with:', { messageText, context });
      onOptimisticMessage({
        message_type: 'text',
        content: { text: messageText },
        context,
      });
    } else {
      console.warn('onOptimisticMessage not provided');
    }

    // Send in background
    try {
      const fromNumber = await getFromNumber();
      await sendTextMessage(fromNumber, conversation.phone_number, messageText, false, context);
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setMessage(value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    // Check if "/" is typed for quick replies
    if (value.startsWith('/')) {
      const search = value.slice(1).toLowerCase();
      setQuickReplySearch(search);
      setShowQuickReplies(true);
    } else {
      setShowQuickReplies(false);
      setQuickReplySearch('');
    }
  }

  async function handleQuickReplySelect(reply: QuickReply) {
    setShowQuickReplies(false);
    setQuickReplySearch('');
    setMessage('');

    if (reply.message_type === 'text') {
      setMessage(reply.message || '');
      textareaRef.current?.focus();

      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
      }
    } else {
      try {
        const fromNumber = await getFromNumber();
        await sendMediaMessage(
          fromNumber,
          conversation.phone_number,
          reply.message_type,
          reply.media_url!,
          reply.caption || undefined
        );
      } catch (error) {
        console.error('Error sending media quick reply:', error);
        alert(error instanceof Error ? error.message : 'Failed to send media');
      }
    }
  }

  const filteredQuickReplies = quickReplies.filter(reply => {
    const searchLower = quickReplySearch.toLowerCase();
    const shortcutMatch = reply.shortcut.toLowerCase().includes(searchLower);
    const messageMatch = reply.message?.toLowerCase().includes(searchLower) || false;
    const captionMatch = reply.caption?.toLowerCase().includes(searchLower) || false;
    return shortcutMatch || messageMatch || captionMatch;
  });

  function handleEmojiSelect(emoji: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = message;
    const newText = text.substring(0, start) + emoji + text.substring(end);

    setMessage(newText);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + emoji.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const fromNumber = await getFromNumber();

      if (file.type.startsWith('audio/')) {
        const supportedAudioTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr'];
        if (!supportedAudioTypes.some(type => file.type.includes(type.split('/')[1]))) {
          throw new Error('Unsupported audio format. Please use OGG, MP3, MP4, AAC, or AMR format.');
        }
      }

      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, file, { contentType: file.type, cacheControl: '3600' });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(data.path);

      const mediaType = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('audio/') ? 'audio' : 'document';

      await sendMediaMessage(fromNumber, conversation.phone_number, mediaType, publicUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleSendVoice(audioBlob, mimeType);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }

  async function handleSendVoice(audioBlob: Blob, mimeType: string) {
    try {
      const fromNumber = await getFromNumber();

      if (!mimeType.includes('ogg')) {
        alert('Your browser does not support the required audio format (OGG/Opus) for WhatsApp. Please try using Chrome, Firefox, or Edge.');
        return;
      }

      const fileName = `voice_${Date.now()}.ogg`;

      const { data, error } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, audioBlob, {
          contentType: 'audio/ogg',
          cacheControl: '3600',
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(data.path);

      await sendMediaMessage(fromNumber, conversation.phone_number, 'audio', publicUrl);

      setTimeout(async () => {
        try {
          await supabase.storage.from('whatsapp-media').remove([fileName]);
        } catch (cleanupError) {
          console.error('Error cleaning up voice file:', cleanupError);
        }
      }, 60000);
    } catch (error) {
      console.error('Error sending voice message:', error);
      alert(error instanceof Error ? error.message : 'Failed to send voice message');
    }
  }

  function formatRecordingTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getReplyPreviewText(msg: Message): string {
    if (msg.message_type === 'text') return msg.content.text || '';
    if (msg.message_type === 'image') return '📷 Photo';
    if (msg.message_type === 'video') return '🎥 Video';
    if (msg.message_type === 'audio') return '🎵 Audio';
    if (msg.message_type === 'document') return '📄 Document';
    if (msg.message_type === 'location') return '📍 Location';
    if (msg.message_type === 'contact') return '👤 Contact';
    return 'Message';
  }

  function isMessageWindowOpen(): boolean {
    const lastInboundMessage = messages
      .filter(m => m.direction === 'inbound')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    if (!lastInboundMessage) return false;

    const lastMessageTime = new Date(lastInboundMessage.timestamp).getTime();
    const now = Date.now();
    const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60);

    return hoursSinceLastMessage < 24;
  }

  function getHoursUntilWindowCloses(): number {
    const lastInboundMessage = messages
      .filter(m => m.direction === 'inbound')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    if (!lastInboundMessage) return 0;

    const lastMessageTime = new Date(lastInboundMessage.timestamp).getTime();
    const now = Date.now();
    const hoursRemaining = 24 - (now - lastMessageTime) / (1000 * 60 * 60);

    return Math.max(0, hoursRemaining);
  }

  const canSendMessage = !isCompanyLocked && (messages.length === 0 || isMessageWindowOpen());

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="bg-white md:bg-[#f0f2f5] border-t border-gray-200 md:border-gray-200 px-4 py-3 sticky bottom-0 z-10">
        {isCompanyLocked && (
          <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 mb-1">Subscription Locked</p>
              <p className="text-xs text-red-700">
                Your company account is locked due to subscription status. Please contact your Super Admin or renew your subscription to send messages.
              </p>
            </div>
          </div>
        )}
        {!isCompanyLocked && !canSendMessage && (
          <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">24-Hour Message Window Closed</p>
              <p className="text-xs text-amber-700">
                You can't send messages because it's been more than 24 hours since the customer's last message.
                Wait for them to message you first to continue the conversation.
              </p>
            </div>
          </div>
        )}
        {replyingTo && (
          <div className="mb-2 px-3 py-2 bg-white border-l-[3px] border-green-600 rounded-md flex items-start justify-between shadow-sm">
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-green-700 mb-0.5">
                Replying to {replyingTo.direction === 'inbound' ? conversation.contact_name : 'You'}
              </div>
              <div className="text-[13px] text-gray-600 truncate">
                {getReplyPreviewText(replyingTo)}
              </div>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-full shadow-sm">
            <div className="flex-1 flex items-center gap-3 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              <span className="font-semibold text-sm">{formatRecordingTime(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all transform hover:scale-105 shadow-md"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="relative">
              <button
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={uploadingFile || !canSendMessage}
              >
                {uploadingFile ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                ) : (
                  <Paperclip className="w-5 h-5 text-gray-600" />
                )}
              </button>

              {showAttachMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-48">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowAttachMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Upload className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-900">Upload File</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMediaModal(true);
                      setShowAttachMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Image className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-900">Media URL</span>
                  </button>
                <button
                  onClick={() => {
                    setShowInteractiveModal(true);
                    setShowAttachMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                >
                  <CircleDot className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-900">Interactive</span>
                </button>
                <button
                  onClick={() => {
                    setShowLocationModal(true);
                    setShowAttachMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                >
                  <MapPin className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-900">Location</span>
                </button>
                <button
                  onClick={() => {
                    setShowContactModal(true);
                    setShowAttachMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                >
                  <User className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-gray-900">Contact</span>
                </button>
                <button
                  onClick={() => {
                    setShowTemplateModal(true);
                    setShowAttachMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                >
                  <FileCode className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-gray-900">Template</span>
                </button>
              </div>
            )}
          </div>

            <div className="flex-1 relative">
              {showQuickReplies && filteredQuickReplies.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50">
                  <div className="p-2 border-b border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-600 font-medium">Quick Replies - Select one</p>
                  </div>
                  <div className="py-1">
                    {filteredQuickReplies.map((reply) => (
                      <button
                        key={reply.id}
                        onClick={() => handleQuickReplySelect(reply)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-green-600">/{reply.shortcut}</span>
                          {reply.message_type !== 'text' && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              {reply.message_type}
                            </span>
                          )}
                        </div>
                        {reply.message_type === 'text' ? (
                          <p className="text-sm text-gray-700 line-clamp-2">{reply.message}</p>
                        ) : (
                          <div className="text-xs text-gray-600 flex items-center gap-1">
                            {reply.message_type === 'image' && <Image className="w-3 h-3" />}
                            {reply.message_type === 'video' && <Video className="w-3 h-3" />}
                            {reply.caption ? (
                              <span className="line-clamp-2">{reply.caption}</span>
                            ) : (
                              <span className="italic">No caption</span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2 bg-gray-100 md:bg-white rounded-full px-3 py-2 shadow-sm">
                <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                  type="button"
                >
                  <Smile className="w-5 h-5 text-gray-500" />
                </button>
                {showEmojiPicker && (
                  <EmojiPicker
                    onEmojiSelect={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>

              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextareaChange}
                onKeyPress={handleKeyPress}
                placeholder={canSendMessage ? "Message" : "24-hour window closed"}
                className="flex-1 resize-none bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none max-h-32 text-[15px] py-1 disabled:text-gray-400"
                rows={1}
                disabled={!canSendMessage}
              />
              </div>
            </div>

            {message.trim() ? (
              <button
                onClick={handleSendText}
                disabled={!canSendMessage}
                className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008069] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={!canSendMessage}
                className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008069] transition-all transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {showMediaModal && (
        <MediaModal
          conversation={conversation}
          getFromNumber={getFromNumber}
          onClose={() => setShowMediaModal(false)}
        />
      )}

      {showInteractiveModal && (
        <InteractiveModal
          conversation={conversation}
          getFromNumber={getFromNumber}
          onClose={() => setShowInteractiveModal(false)}
        />
      )}

      {showLocationModal && (
        <LocationModal
          conversation={conversation}
          getFromNumber={getFromNumber}
          onClose={() => setShowLocationModal(false)}
        />
      )}

      {showContactModal && (
        <ContactModal
          conversation={conversation}
          getFromNumber={getFromNumber}
          onClose={() => setShowContactModal(false)}
        />
      )}

      {showTemplateModal && (
        <TemplateModal
          conversation={conversation}
          getFromNumber={getFromNumber}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </>
  );
}
