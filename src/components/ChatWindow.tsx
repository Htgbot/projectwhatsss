import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Smile, MoreVertical, Phone, Video, Image, FileText, MapPin, User, ArrowLeft, MessageCircle } from 'lucide-react';
import { supabase, Message, Conversation } from '../lib/supabase';
import { sendTextMessage, sendReactionMessage, getDefaultBusinessNumber } from '../lib/whatsapp-api';
import { playNotificationSound } from '../lib/notifications';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import ConversationDetailsModal from './ConversationDetailsModal';
import MediaPreviewModal from './MediaPreviewModal';

interface ChatWindowProps {
  conversation: Conversation;
  onBack?: () => void;
}

export default function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{
    isOpen: boolean;
    url: string;
    type: 'image' | 'video' | 'document';
    caption?: string;
    filename?: string;
  }>({ isOpen: false, url: '', type: 'image' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const isNewConversation = prevConversationIdRef.current !== conversation.id;
    prevConversationIdRef.current = conversation.id;

    loadMessages();

    if (isNewConversation && conversation.unread_count > 0) {
      markConversationAsRead();
    }

    const channel = supabase
      .channel(`messages:${conversation.id}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          const newMessage = payload.new as Message;

          setMessages((prev) => {
            // Check if this message replaces a pending one
            const pendingIndex = prev.findIndex(msg =>
              msg.isPending &&
              msg.message_type === newMessage.message_type &&
              msg.direction === 'outbound' &&
              JSON.stringify(msg.content) === JSON.stringify(newMessage.content)
            );

            if (pendingIndex !== -1) {
              // Replace pending message with confirmed one
              const updated = [...prev];
              updated[pendingIndex] = newMessage;
              return updated;
            }

            // Check if message already exists (avoid duplicates)
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              return prev;
            }

            return [...prev, newMessage];
          });

          if (newMessage.direction === 'inbound') {
            playNotificationSound();
          }

          setTimeout(() => scrollToBottom(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          console.log('Message updated:', payload);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? (payload.new as Message) : msg
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markConversationAsRead() {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversation.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }

  async function handleReaction(message: Message, emoji: string) {
    try {
      // Only allow reactions to inbound messages
      if (message.direction !== 'inbound') {
        alert('You can only react to messages from the customer');
        return;
      }

      // WhatsApp message_id must start with 'wamid.'
      if (!message.message_id || !message.message_id.startsWith('wamid.')) {
        alert('Cannot react to this message (invalid WhatsApp message ID)');
        return;
      }

      const fromNumber = conversation.from_number || await getDefaultBusinessNumber();
      if (!fromNumber) {
        alert('No business number available');
        return;
      }

      await sendReactionMessage(
        fromNumber,
        conversation.phone_number,
        message.message_id,
        emoji
      );
    } catch (error) {
      console.error('Error sending reaction:', error);
      alert('Failed to send reaction');
    }
  }

  function handleMediaClick(
    url: string,
    type: 'image' | 'video' | 'document',
    caption?: string,
    filename?: string
  ) {
    setMediaPreview({
      isOpen: true,
      url,
      type,
      caption,
      filename,
    });
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function addOptimisticMessage(messageData: Partial<Message>) {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage: Message = {
      id: tempId,
      tempId,
      conversation_id: conversation.id,
      message_id: null,
      from_number: conversation.from_number,
      direction: 'outbound',
      message_type: messageData.message_type || 'text',
      content: messageData.content || {},
      status: 'pending',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      isPending: true,
      context: messageData.context,
    };

    console.log('Adding optimistic message:', optimisticMessage);
    setMessages((prev) => {
      const updated = [...prev, optimisticMessage];
      console.log('Messages after adding optimistic:', updated.length);
      return updated;
    });

    // Scroll immediately
    setTimeout(() => scrollToBottom(), 10);
  }

  function formatDate(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function groupMessagesByDate(messages: Message[]) {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach((message) => {
      const dateKey = formatDate(message.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return groups;
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col h-screen md:h-full bg-[#e5ddd5] w-full">
      <div className="bg-[#008069] md:bg-[#f0f2f5] border-b border-[#00a884] md:border-gray-200 px-3 md:px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 hover:bg-[#00a884] rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
          )}
          <div className="w-10 h-10 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-semibold shadow-md flex-shrink-0">
            {conversation.contact_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white md:text-gray-900 text-[16px] md:text-[15px] truncate">{conversation.contact_name}</h2>
            <p className="text-[13px] md:text-[13px] text-gray-400 md:text-gray-500 truncate">{conversation.phone_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button
            onClick={() => setShowDetailsModal(true)}
            className="p-1.5 md:p-2 hover:bg-[#00a884] md:hover:bg-gray-200 rounded-full transition-colors"
            title="Conversation details"
          >
            <MoreVertical className="w-6 h-6 text-white md:text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-4 bg-white md:bg-[#e5ddd5]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-16 h-16 mb-4 text-gray-400" />
            <p className="text-lg">No messages yet</p>
            <p className="text-sm mt-1">Start the conversation!</p>
          </div>
        ) : (
          <>
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center justify-center my-6">
                  <span className="bg-white text-gray-700 text-xs px-3 py-1.5 rounded-md shadow-sm">
                    {date}
                  </span>
                </div>
                {msgs.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onReply={setReplyingTo}
                    onReact={handleReaction}
                    onMediaClick={handleMediaClick}
                  />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <MessageComposer
        conversation={conversation}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        messages={messages}
        onOptimisticMessage={addOptimisticMessage}
      />

      {showDetailsModal && (
        <ConversationDetailsModal
          conversation={conversation}
          onClose={() => setShowDetailsModal(false)}
        />
      )}

      <MediaPreviewModal
        isOpen={mediaPreview.isOpen}
        onClose={() => setMediaPreview({ ...mediaPreview, isOpen: false })}
        mediaUrl={mediaPreview.url}
        mediaType={mediaPreview.type}
        caption={mediaPreview.caption}
        filename={mediaPreview.filename}
      />
    </div>
  );
}
