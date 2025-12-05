import { useState, useEffect } from 'react';
import { Check, X, Phone, Building } from 'lucide-react';
import { supabase, BusinessNumber } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PendingNumber extends BusinessNumber {
  companies: {
    name: string;
  } | null;
}

interface NumberApprovalsProps {
  onBack?: () => void;
  isEmbedded?: boolean;
}

export default function NumberApprovals({ onBack, isEmbedded = false }: NumberApprovalsProps) {
  const { isSuperAdmin } = useAuth();
  const [numbers, setNumbers] = useState<PendingNumber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) {
      loadPendingNumbers();
    }
  }, [isSuperAdmin]);

  async function loadPendingNumbers() {
    try {
      const { data, error } = await supabase
        .from('business_numbers')
        .select('*, companies(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNumbers(data as any || []);
    } catch (error) {
      console.error('Error loading pending numbers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(id: string, status: 'active' | 'rejected') {
    try {
      const { error } = await supabase
        .from('business_numbers')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      loadPendingNumbers();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className={`max-w-4xl mx-auto ${isEmbedded ? 'p-0' : 'p-6'}`}>
      {!isEmbedded && (
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Pending Number Approvals</h1>
          {onBack && (
            <button onClick={onBack} className="text-gray-600 hover:text-gray-900">
              Back
            </button>
          )}
        </div>
      )}

      <div className={`bg-white rounded-lg shadow overflow-hidden ${isEmbedded ? 'border border-gray-200 shadow-sm' : ''}`}>
        {numbers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No pending numbers to approve.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {numbers.map((num) => (
                <tr key={num.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Building className="w-4 h-4 mr-2 text-gray-400" />
                      {num.companies?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Phone className="w-4 h-4 mr-2 text-gray-400" />
                      {num.phone_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {num.display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleStatusUpdate(num.id, 'active')}
                      className="text-green-600 hover:text-green-900 mr-4"
                      title="Approve"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(num.id, 'rejected')}
                      className="text-red-600 hover:text-red-900"
                      title="Reject"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
