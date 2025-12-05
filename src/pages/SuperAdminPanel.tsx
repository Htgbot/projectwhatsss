import { useState } from 'react';
import { Users, Phone, Building2, ArrowLeft, Shield } from 'lucide-react';
import UserManagement from './UserManagement';
import NumberApprovals from './NumberApprovals';

interface SuperAdminPanelProps {
  onBack: () => void;
}

type AdminTab = 'users' | 'approvals' | 'companies';

export default function SuperAdminPanel({ onBack }: SuperAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  return (
    <div className="flex-1 flex flex-col bg-gray-50 w-full h-screen overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-600" />
              Super Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500">System-wide management and controls</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'users'
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">User Management</p>
                <p className="text-xs opacity-70">Manage users & roles</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Phone className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">Number Approvals</p>
                <p className="text-xs opacity-70">Review pending numbers</p>
              </div>
            </button>
          </nav>
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-hidden bg-gray-50 relative">
          {activeTab === 'users' && (
            <div className="h-full overflow-auto">
              {/* We reuse UserManagement but hide its header/back button via CSS or props if possible. 
                  Since UserManagement has its own header, we might need to adjust it or wrap it.
                  For now, we render it directly. Ideally, we'd strip the header from UserManagement 
                  or pass a prop to hide it. Let's assume we'll refactor UserManagement slightly next.
              */}
              <UserManagement onBack={() => {}} onNavigateToSettings={undefined} isEmbedded={true} />
            </div>
          )}
          
          {activeTab === 'approvals' && (
            <div className="h-full overflow-auto p-6">
              <NumberApprovals onBack={() => {}} isEmbedded={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
