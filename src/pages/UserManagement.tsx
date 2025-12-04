import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Shield, User, Settings as SettingsIcon } from 'lucide-react';
import { supabase, UserProfile } from '../lib/supabase';

interface UserManagementProps {
  onBack: () => void;
  onNavigateToSettings?: () => void;
}

export default function UserManagement({ onBack, onNavigateToSettings }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'super_admin'>('user');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser() {
    if (!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setAdding(true);
    try {
      const {data, error: signUpError } = await supabase.auth.admin.createUser({
        email: newEmail.trim(),
        password: newPassword.trim(),
        email_confirm: true,
        user_metadata: {
          display_name: newDisplayName.trim(),
          role: newRole,
        },
      });

      if (signUpError) throw signUpError;

      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRole('user');
      setShowAddUser(false);
      loadUsers();
      alert('User created successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to create user');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
    } catch (error: any) {
      alert(error.message || 'Failed to update user status');
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white w-full">
      <div className="bg-[#008069] md:bg-[#f0f2f5] border-b border-gray-200 px-3 md:px-4 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#017561] md:hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white md:text-gray-700" />
          </button>
          <h1 className="text-lg md:text-xl font-semibold text-white md:text-gray-900 truncate">User Management</h1>
        </div>
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </button>
          )}
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
        <div className="md:hidden flex items-center gap-1 flex-shrink-0">
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="p-2 hover:bg-[#017561] rounded-full transition-colors"
            >
              <SettingsIcon className="w-5 h-5 text-white" />
            </button>
          )}
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="p-2 hover:bg-[#017561] rounded-full transition-colors"
          >
            <UserPlus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-4xl mx-auto">
          {showAddUser && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-4 md:mb-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Add New User</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role *
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as 'user' | 'super_admin')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="user">User</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddUser}
                    disabled={adding}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {adding ? 'Creating...' : 'Create User'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddUser(false);
                      setNewEmail('');
                      setNewPassword('');
                      setNewDisplayName('');
                      setNewRole('user');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{user.display_name}</p>
                      {user.role === 'super_admin' ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          <Shield className="w-3 h-3" />
                          Super Admin
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          <User className="w-3 h-3" />
                          User
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleStatus(user.id, user.status)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {user.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
