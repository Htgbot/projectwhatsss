import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Search, Plus, Filter } from 'lucide-react';
import { supabase, Conversation, BusinessNumber } from '../lib/supabase';
import { requestNotificationPermission, showNotification, canShowNotifications } from '../lib/notifications';

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
}

export default function ConversationList({
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [businessNumbers, setBusinessNumbers] = useState<BusinessNumber[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread'>('all');
  const [selectedNumber, setSelectedNumber] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const prevConversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    requestNotificationPermission();
    loadConversations();
    loadBusinessNumbers();

    const conversationsChannel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations();
      })
      .subscribe();

    const messagesChannel = supabase
      .channel('all-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as any;
          const { data: conversation } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', newMessage.conversation_id)
            .single();

          if (conversation && canShowNotifications() && newMessage.direction === 'inbound') {
            const messageText = newMessage.message_type === 'text'
              ? newMessage.content.text
              : `${newMessage.message_type} message`;

            showNotification(`New message from ${conversation.contact_name}`, {
              body: messageText || 'New message',
              tag: conversation.id,
            });
          }

          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  async function loadBusinessNumbers() {
    try {
      const { data, error } = await supabase
        .from('business_numbers')
        .select('*')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setBusinessNumbers(data || []);
    } catch (error) {
      console.error('Error loading business numbers:', error);
    }
  }

  async function loadConversations() {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_time', { ascending: false });

      if (error) throw error;
      const newConversations = data || [];

      if (prevConversationsRef.current.length > 0 && canShowNotifications()) {
        newConversations.forEach(newConv => {
          const prevConv = prevConversationsRef.current.find(c => c.id === newConv.id);
          if (prevConv && newConv.unread_count > prevConv.unread_count) {
            showNotification(`New message from ${newConv.contact_name}`, {
              body: newConv.last_message,
              tag: newConv.id,
            });
          }
        });
      }

      prevConversationsRef.current = newConversations;
      setConversations(newConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.phone_number.includes(searchQuery);

    const matchesUnread = selectedFilter === 'all' || (selectedFilter === 'unread' && conv.unread_count > 0);

    const matchesNumber = selectedNumber === 'all' || conv.from_number === selectedNumber;

    return matchesSearch && matchesUnread && matchesNumber;
  });

  function formatTime(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  }

  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="hidden md:block p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">Messages</h1>
          <button
            onClick={onNewConversation}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="New conversation"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Filter Section */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-[#00a884] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedFilter('unread')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedFilter === 'unread'
                  ? 'bg-[#00a884] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread
            </button>
          </div>

          {businessNumbers.length > 1 && (
            <div className="relative">
              <select
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="all">All Numbers</option>
                {businessNumbers.map((num) => (
                  <option key={num.id} value={num.phone_number}>
                    {num.display_name} ({num.phone_number})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden p-3 border-b border-gray-200 bg-white space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 text-gray-900 placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>

        {/* Mobile Filters */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-[#00a884] text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedFilter('unread')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedFilter === 'unread'
                  ? 'bg-[#00a884] text-white'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            Unread
          </button>
          </div>

          {businessNumbers.length > 1 && (
            <select
              value={selectedNumber}
              onChange={(e) => setSelectedNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="all">All Numbers</option>
              {businessNumbers.map((num) => (
                <option key={num.id} value={num.phone_number}>
                  {num.display_name} ({num.phone_number})
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={onNewConversation}
          className="w-full py-2 bg-[#00a884] text-white rounded-lg font-medium text-sm hover:bg-[#008069] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <MessageCircle className="w-12 h-12 mb-2 text-gray-300" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={`w-full p-3 hover:bg-gray-50 transition-all duration-150 border-b border-gray-100 text-left ${
                selectedConversationId === conversation.id ? 'bg-[#f0f2f5]' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-sm">
                  {conversation.contact_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate text-[15px]">
                      {conversation.contact_name}
                    </h3>
                    <span className="text-[12px] text-gray-500 ml-2 flex-shrink-0">
                      {formatTime(conversation.last_message_time)}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-600 truncate leading-tight">{conversation.last_message}</p>
                </div>
                {conversation.unread_count > 0 && (
                  <span className="ml-2 bg-[#00a884] text-white text-[11px] rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-semibold">
                    {conversation.unread_count}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
