import { useState } from 'react';
import { MessageSquare, Settings as SettingsIcon, Users, LogOut, Menu, X, Phone, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import NewConversationModal from '../components/NewConversationModal';
import Settings from './Settings';
import UserManagement from './UserManagement';
import NumberApprovals from './NumberApprovals';
import SuperAdminPanel from './SuperAdminPanel';
import { Conversation } from '../lib/supabase';

type Tab = 'chats' | 'settings' | 'users' | 'approvals' | 'superadmin';

export default function Dashboard() {
  const { signOut, isSuperAdmin, isAdmin, isWorker, profile } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  async function handleSignOut() {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut();
    }
  }

  function handleConversationCreated(conversationId: string) {
    setShowNewConversation(false);
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-white md:bg-gray-100">
      {activeTab === 'chats' ? (
        <>
          {/* Mobile Header - Only show when no conversation selected */}
          {!selectedConversation && (
            <div className="md:hidden bg-[#008069] text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-6 h-6" />
                <h1 className="text-xl font-semibold">WhatsApp</h1>
              </div>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 hover:bg-[#00a884] rounded-full transition-colors"
              >
                {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          )}

          {/* Mobile Menu */}
          {showMobileMenu && !selectedConversation && (
            <div className="md:hidden bg-white border-b border-gray-200 py-2">
              {!isWorker && (
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowMobileMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <SettingsIcon className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-900">Settings</span>
                </button>
              )}
              {isSuperAdmin ? (
                <button
                  onClick={() => {
                    setActiveTab('superadmin');
                    setShowMobileMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <Shield className="w-5 h-5 text-purple-600" />
                  <span className="text-gray-900">Super Admin Panel</span>
                </button>
              ) : isAdmin && (
                <button
                  onClick={() => {
                    setActiveTab('users');
                    setShowMobileMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-900">User Management</span>
                  <span className="ml-auto px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Admin</span>
                </button>
              )}
              <button
                onClick={() => {
                  handleSignOut();
                  setShowMobileMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-3 text-red-600"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Conversation List - Hidden on mobile when chat is selected */}
          <div className={`${selectedConversation ? 'hidden md:block' : 'block'} md:w-auto flex-shrink-0`}>
            <ConversationList
              selectedConversationId={selectedConversation?.id || null}
              onSelectConversation={setSelectedConversation}
              onNewConversation={() => setShowNewConversation(true)}
            />
          </div>

          {selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
            />
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-500 relative bg-[#f0f2f5]">
              <div className="absolute top-4 right-4 flex items-center gap-3">
                {!isWorker && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="p-2.5 hover:bg-gray-200 rounded-full transition-colors shadow-sm bg-white"
                    title="Settings"
                  >
                    <SettingsIcon className="w-6 h-6 text-gray-700" />
                  </button>
                )}
                {isSuperAdmin ? (
                  <button
                    onClick={() => setActiveTab('superadmin')}
                    className="p-2.5 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors shadow-lg"
                    title="Super Admin Panel"
                  >
                    <Shield className="w-6 h-6 text-white" />
                  </button>
                ) : isAdmin && (
                  <button
                    onClick={() => setActiveTab('users')}
                    className="p-2.5 bg-blue-500 hover:bg-blue-600 rounded-full transition-colors shadow-lg"
                    title="User Management"
                  >
                    <Users className="w-6 h-6 text-white" />
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="p-2.5 hover:bg-red-50 rounded-full transition-colors shadow-sm bg-white"
                  title="Sign Out"
                >
                  <LogOut className="w-6 h-6 text-red-600" />
                </button>
              </div>
              <MessageSquare className="w-24 h-24 mb-4 text-gray-300" />
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">WhatsApp Business</h2>
              <p className="text-center max-w-md text-gray-600 px-4">
                Select a conversation from the list to start messaging
              </p>
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 mb-2">
                  Signed in as <span className="font-semibold text-gray-700">{profile?.display_name || 'Loading...'}</span>
                </p>
                {isSuperAdmin && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border-2 border-purple-200 rounded-full">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-semibold text-purple-700">Super Admin Access</span>
                  </div>
                )}
                {isAdmin && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-200 rounded-full">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">Admin Access</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {showNewConversation && (
            <NewConversationModal
              onClose={() => setShowNewConversation(false)}
              onCreated={handleConversationCreated}
            />
          )}
        </>
      ) : activeTab === 'settings' ? (
        <Settings
          onBack={() => setActiveTab('chats')}
          onNavigateToUsers={(isSuperAdmin || isAdmin) ? () => setActiveTab('users') : undefined}
        />
      ) : activeTab === 'superadmin' ? (
        <SuperAdminPanel onBack={() => setActiveTab('chats')} />
      ) : activeTab === 'approvals' ? (
        <NumberApprovals onBack={() => setActiveTab('chats')} />
      ) : (
        <UserManagement
          onBack={() => setActiveTab('chats')}
          onNavigateToSettings={!isWorker ? () => setActiveTab('settings') : undefined}
        />
      )}
    </div>
  );
}
