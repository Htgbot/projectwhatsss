import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase, BusinessNumber } from '../lib/supabase';

interface NewConversationModalProps {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export default function NewConversationModal({ onClose, onCreated }: NewConversationModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [businessNumbers, setBusinessNumbers] = useState<BusinessNumber[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBusinessNumbers();
  }, []);

  async function loadBusinessNumbers() {
    try {
      const { data, error } = await supabase
        .from('business_numbers')
        .select('*')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setBusinessNumbers(data || []);

      const defaultNumber = data?.find(n => n.is_default);
      if (defaultNumber) {
        setFromNumber(defaultNumber.phone_number);
      }
    } catch (error) {
      console.error('Error loading business numbers:', error);
    }
  }

  async function handleCreate() {
    if (!phoneNumber.trim() || !contactName.trim() || !fromNumber.trim() || creating) return;

    setCreating(true);
    try {
      const { data: existing, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .eq('phone_number', phoneNumber.trim())
        .eq('from_number', fromNumber.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        alert('A conversation with this phone number and business number already exists');
        onCreated(existing.id);
        onClose();
        return;
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          phone_number: phoneNumber.trim(),
          from_number: fromNumber.trim(),
          contact_name: contactName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      onCreated(data.id);
      onClose();
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Failed to create conversation. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleCreate();
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="+1234567890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Number (From)
            </label>
            {businessNumbers.length === 0 ? (
              <div className="text-sm text-red-600">
                No business numbers configured. Please add one in settings first.
              </div>
            ) : (
              <select
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {businessNumbers.map((num) => (
                  <option key={num.id} value={num.phone_number}>
                    {num.display_name} ({num.phone_number})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!phoneNumber.trim() || !contactName.trim() || !fromNumber.trim() || creating || businessNumbers.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
