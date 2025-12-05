import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Shield, User, Settings as SettingsIcon, Building2, Lock, Unlock } from 'lucide-react';
import { supabase, UserProfile, Company } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UserManagementProps {
  onBack: () => void;
  onNavigateToSettings?: () => void;
}

export default function UserManagement({ onBack, onNavigateToSettings }: UserManagementProps) {
  const { isSuperAdmin, isAdmin, profile, company: currentCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'companies'>('users');
  
  const [users, setUsers] = useState<(UserProfile & { company?: Company })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add User State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'worker' | 'superadmin'>('worker');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [addingUser, setAddingUser] = useState(false);

  // Add Company State
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);

  useEffect(() => {
    loadData();
  }, [isSuperAdmin, isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      // Load Companies (Superadmin only needs all, Admin knows their own)
      if (isSuperAdmin) {
        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .order('name');
        if (companiesError) throw companiesError;
        setCompanies(companiesData || []);
      }

      // Load Users
      let query = supabase
        .from('user_profiles')
        .select('*, company:companies(*)')
        .order('created_at', { ascending: false });

      // Admin can only see users in their company
      if (isAdmin && currentCompany) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data: usersData, error: usersError } = await query;
      if (usersError) throw usersError;
      
      // @ts-ignore - Supabase join typing is tricky
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser() {
    if (!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim()) {
      alert('Please fill in all fields');
      return;
    }

    if (isSuperAdmin && newRole !== 'superadmin' && !selectedCompanyId) {
      alert('Please select a company for the user');
      return;
    }

    setAddingUser(true);
    try {
      const { data, error } = await supabase.rpc('create_managed_user', {
        new_email: newEmail.trim(),
        new_password: newPassword.trim(),
        new_role: newRole,
        new_company_id: isSuperAdmin ? (newRole === 'superadmin' ? null : selectedCompanyId) : currentCompany?.id,
        new_display_name: newDisplayName.trim()
      });

      if (error) throw error;

      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRole('worker');
      setSelectedCompanyId('');
      setShowAddUser(false);
      loadData();
      alert('User created successfully!');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to create user');
    } finally {
      setAddingUser(false);
    }
  }

  async function handleAddCompany() {
    if (!newCompanyName.trim()) return;
    setAddingCompany(true);
    try {
      const { error } = await supabase.from('companies').insert({
        name: newCompanyName.trim(),
        subscription_status: 'active'
      });
      if (error) throw error;
      
      setNewCompanyName('');
      setShowAddCompany(false);
      loadData();
      alert('Company created successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to create company');
    } finally {
      setAddingCompany(false);
    }
  }

  async function handleToggleCompanyStatus(companyId: string, currentStatus: string) {
    try {
      const newStatus = currentStatus === 'active' ? 'locked' : 'active';
      const { error } = await supabase
        .from('companies')
        .update({ subscription_status: newStatus })
        .eq('id', companyId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to update status');
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
      <div className="bg-[#008069] md:bg-[#f0f2f5] border-b border-gray-200 px-3 md:px-4 py-3 md:py-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#017561] md:hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-white md:text-gray-700" />
            </button>
            <h1 className="text-lg md:text-xl font-semibold text-white md:text-gray-900 truncate">
              {isSuperAdmin ? 'System Management' : 'Team Management'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            )}
            
            {activeTab === 'users' ? (
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden md:inline">Add User</span>
              </button>
            ) : (
               <button
                onClick={() => setShowAddCompany(!showAddCompany)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden md:inline">Add Company</span>
              </button>
            )}
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex gap-4 border-b border-gray-200/20">
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2 text-sm font-medium ${
                activeTab === 'users'
                  ? 'text-white md:text-green-600 border-b-2 border-white md:border-green-600'
                  : 'text-green-100 md:text-gray-500 hover:text-white md:hover:text-gray-700'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={`pb-2 text-sm font-medium ${
                activeTab === 'companies'
                  ? 'text-white md:text-green-600 border-b-2 border-white md:border-green-600'
                  : 'text-green-100 md:text-gray-500 hover:text-white md:hover:text-gray-700'
              }`}
            >
              Companies
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-4xl mx-auto">
          
          {/* --- USERS TAB --- */}
          {activeTab === 'users' && (
            <>
              {showAddUser && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-4 md:mb-6">
                  <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Add New User</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Display Name *</label>
                        <input
                          type="text"
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as any)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                          {isSuperAdmin && <option value="admin">Admin</option>}
                          <option value="worker">Worker</option>
                        </select>
                      </div>
                    </div>

                    {isSuperAdmin && newRole !== 'superadmin' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Company *</label>
                        <select
                          value={selectedCompanyId}
                          onChange={(e) => setSelectedCompanyId(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Select a company...</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleAddUser}
                        disabled={addingUser}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {addingUser ? 'Creating...' : 'Create User'}
                      </button>
                      <button
                        onClick={() => setShowAddUser(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold">
                        {user.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{user.display_name}</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role}
                          </span>
                          {user.company && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                              <Building2 className="w-3 h-3" />
                              {user.company.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* --- COMPANIES TAB (Superadmin only) --- */}
          {activeTab === 'companies' && isSuperAdmin && (
            <>
              {showAddCompany && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-4">
                  <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Add New Company</h2>
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                      <input
                        type="text"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <button
                      onClick={handleAddCompany}
                      disabled={addingCompany}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 mb-[1px]"
                    >
                      {addingCompany ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => setShowAddCompany(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 mb-[1px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {companies.map((comp) => (
                  <div key={comp.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{comp.name}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          comp.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {comp.subscription_status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCompanyStatus(comp.id, comp.subscription_status)}
                      className={`p-2 rounded-lg transition-colors ${
                        comp.subscription_status === 'active' 
                          ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                      title={comp.subscription_status === 'active' ? 'Lock Company' : 'Unlock Company'}
                    >
                      {comp.subscription_status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
