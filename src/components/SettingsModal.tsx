import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BusinessNumber {
  id: string;
  phone_number: string;
  display_name: string;
  is_default: boolean;
  created_at: string;
}

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [numbers, setNumbers] = useState<BusinessNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNumber, setNewNumber] = useState({ phone_number: '', display_name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNumbers();
  }, []);

  async function loadNumbers() {
    try {
      const { data, error } = await supabase
        .from('business_numbers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNumbers(data || []);
    } catch (error) {
      console.error('Error loading business numbers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNumber() {
    if (!newNumber.phone_number.trim() || !newNumber.display_name.trim() || saving) return;

    setSaving(true);
    try {
      const isFirstNumber = numbers.length === 0;

      const { error } = await supabase.from('business_numbers').insert({
        phone_number: newNumber.phone_number.trim(),
        display_name: newNumber.display_name.trim(),
        is_default: isFirstNumber,
      });

      if (error) throw error;

      setNewNumber({ phone_number: '', display_name: '' });
      setShowAddForm(false);
      await loadNumbers();
    } catch (error) {
      console.error('Error adding number:', error);
      alert('Failed to add number. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await supabase.from('business_numbers').update({ is_default: false }).neq('id', id);

      await supabase.from('business_numbers').update({ is_default: true }).eq('id', id);

      await loadNumbers();
    } catch (error) {
      console.error('Error setting default number:', error);
      alert('Failed to set default number. Please try again.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this number?')) return;

    try {
      const { error } = await supabase.from('business_numbers').delete().eq('id', id);

      if (error) throw error;
      await loadNumbers();
    } catch (error) {
      console.error('Error deleting number:', error);
      alert('Failed to delete number. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Business Phone Numbers</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Manage your WhatsApp Business phone numbers
                </p>
                {!showAddForm && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Number
                  </button>
                )}
              </div>

              {showAddForm && (
                <div className="p-4 border-2 border-green-500 rounded-lg space-y-3">
                  <h3 className="font-medium">Add New Number</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={newNumber.phone_number}
                      onChange={(e) =>
                        setNewNumber({ ...newNumber, phone_number: e.target.value })
                      }
                      placeholder="+1234567890"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newNumber.display_name}
                      onChange={(e) =>
                        setNewNumber({ ...newNumber, display_name: e.target.value })
                      }
                      placeholder="Main Business Line"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNumber}
                      disabled={
                        !newNumber.phone_number.trim() ||
                        !newNumber.display_name.trim() ||
                        saving
                      }
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewNumber({ phone_number: '', display_name: '' });
                      }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {numbers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No business numbers configured</p>
                  <p className="text-sm mt-2">Add your first number to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {numbers.map((number) => (
                    <div
                      key={number.id}
                      className={`p-4 border-2 rounded-lg flex items-center justify-between ${
                        number.is_default
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">
                            {number.display_name}
                          </h3>
                          {number.is_default && (
                            <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{number.phone_number}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!number.is_default && (
                          <button
                            onClick={() => handleSetDefault(number.id)}
                            className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            Set as Default
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(number.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
