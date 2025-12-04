import { X, Phone, Calendar, Clock } from 'lucide-react';
import { Conversation } from '../lib/supabase';

interface ConversationDetailsModalProps {
  conversation: Conversation;
  onClose: () => void;
}

export default function ConversationDetailsModal({ conversation, onClose }: ConversationDetailsModalProps) {
  function formatDateTime(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function getTimeSinceLastMessage(): string {
    const now = new Date();
    const lastMessage = new Date(conversation.last_message_time);
    const diffMs = now.getTime() - lastMessage.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 1) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Conversation Details</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white text-2xl font-semibold shadow-md">
              {conversation.contact_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 className="text-xl font-semibold text-gray-900">{conversation.contact_name}</h4>
              <p className="text-sm text-gray-500">Contact</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Customer Number</p>
                <p className="text-sm font-medium text-gray-900">{conversation.phone_number}</p>
              </div>
            </div>

            {conversation.from_number && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Business Number</p>
                  <p className="text-sm font-medium text-gray-900">{conversation.from_number}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Last Message</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(conversation.last_message_time)}</p>
                <p className="text-xs text-gray-500 mt-1">{getTimeSinceLastMessage()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Conversation Started</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(conversation.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
