import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Conversation } from '../lib/supabase';
import { sendContactMessage } from '../lib/whatsapp-api';

interface ContactModalProps {
  conversation: Conversation;
  getFromNumber: () => Promise<string>;
  onClose: () => void;
}

interface ContactPhone {
  phone: string;
  type: string;
}

interface ContactEmail {
  email: string;
  type: string;
}

interface Contact {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  phones: ContactPhone[];
  emails: ContactEmail[];
}

export default function ContactModal({ conversation, getFromNumber, onClose }: ContactModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([
    {
      name: {
        formatted_name: '',
        first_name: '',
        last_name: '',
      },
      phones: [{ phone: '', type: 'CELL' }],
      emails: [{ email: '', type: 'WORK' }],
    },
  ]);
  const [sending, setSending] = useState(false);

  function addPhone(contactIndex: number) {
    const newContacts = [...contacts];
    newContacts[contactIndex].phones.push({ phone: '', type: 'CELL' });
    setContacts(newContacts);
  }

  function removePhone(contactIndex: number, phoneIndex: number) {
    const newContacts = [...contacts];
    newContacts[contactIndex].phones = newContacts[contactIndex].phones.filter(
      (_, i) => i !== phoneIndex
    );
    setContacts(newContacts);
  }

  function updatePhone(contactIndex: number, phoneIndex: number, field: string, value: string) {
    const newContacts = [...contacts];
    (newContacts[contactIndex].phones[phoneIndex] as any)[field] = value;
    setContacts(newContacts);
  }

  function addEmail(contactIndex: number) {
    const newContacts = [...contacts];
    newContacts[contactIndex].emails.push({ email: '', type: 'WORK' });
    setContacts(newContacts);
  }

  function removeEmail(contactIndex: number, emailIndex: number) {
    const newContacts = [...contacts];
    newContacts[contactIndex].emails = newContacts[contactIndex].emails.filter(
      (_, i) => i !== emailIndex
    );
    setContacts(newContacts);
  }

  function updateEmail(contactIndex: number, emailIndex: number, field: string, value: string) {
    const newContacts = [...contacts];
    (newContacts[contactIndex].emails[emailIndex] as any)[field] = value;
    setContacts(newContacts);
  }

  function updateName(contactIndex: number, field: string, value: string) {
    const newContacts = [...contacts];
    (newContacts[contactIndex].name as any)[field] = value;
    setContacts(newContacts);
  }

  async function handleSend() {
    if (sending) return;

    const validContacts = contacts
      .filter((contact) => contact.name.formatted_name.trim())
      .map((contact) => ({
        name: {
          formatted_name: contact.name.formatted_name.trim(),
          first_name: contact.name.first_name?.trim(),
          last_name: contact.name.last_name?.trim(),
        },
        phones: contact.phones
          .filter((p) => p.phone.trim())
          .map((p) => ({
            phone: p.phone.trim(),
            type: p.type,
          })),
        emails: contact.emails
          .filter((e) => e.email.trim())
          .map((e) => ({
            email: e.email.trim(),
            type: e.type,
          })),
      }));

    if (validContacts.length === 0 || validContacts[0].phones.length === 0) {
      alert('Please provide at least a name and phone number');
      return;
    }

    setSending(true);
    try {
      const fromNumber = await getFromNumber();
      await sendContactMessage(fromNumber, conversation.phone_number, validContacts);
      onClose();
    } catch (error) {
      console.error('Error sending contact:', error);
      alert('Failed to send contact. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Send Contact</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {contacts.map((contact, contactIndex) => (
            <div key={contactIndex} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={contact.name.formatted_name}
                  onChange={(e) => updateName(contactIndex, 'formatted_name', e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name (optional)
                  </label>
                  <input
                    type="text"
                    value={contact.name.first_name || ''}
                    onChange={(e) => updateName(contactIndex, 'first_name', e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name (optional)
                  </label>
                  <input
                    type="text"
                    value={contact.name.last_name || ''}
                    onChange={(e) => updateName(contactIndex, 'last_name', e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Phone Numbers</label>
                  <button
                    onClick={() => addPhone(contactIndex)}
                    className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Phone
                  </button>
                </div>
                <div className="space-y-2">
                  {contact.phones.map((phone, phoneIndex) => (
                    <div key={phoneIndex} className="flex gap-2">
                      <input
                        type="tel"
                        value={phone.phone}
                        onChange={(e) => updatePhone(contactIndex, phoneIndex, 'phone', e.target.value)}
                        placeholder="+1234567890"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <select
                        value={phone.type}
                        onChange={(e) => updatePhone(contactIndex, phoneIndex, 'type', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="CELL">Mobile</option>
                        <option value="HOME">Home</option>
                        <option value="WORK">Work</option>
                      </select>
                      {contact.phones.length > 1 && (
                        <button
                          onClick={() => removePhone(contactIndex, phoneIndex)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Addresses (optional)
                  </label>
                  <button
                    onClick={() => addEmail(contactIndex)}
                    className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Email
                  </button>
                </div>
                <div className="space-y-2">
                  {contact.emails.map((email, emailIndex) => (
                    <div key={emailIndex} className="flex gap-2">
                      <input
                        type="email"
                        value={email.email}
                        onChange={(e) => updateEmail(contactIndex, emailIndex, 'email', e.target.value)}
                        placeholder="john@example.com"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <select
                        value={email.type}
                        onChange={(e) => updateEmail(contactIndex, emailIndex, 'type', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="HOME">Home</option>
                        <option value="WORK">Work</option>
                      </select>
                      {contact.emails.length > 1 && (
                        <button
                          onClick={() => removeEmail(contactIndex, emailIndex)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
