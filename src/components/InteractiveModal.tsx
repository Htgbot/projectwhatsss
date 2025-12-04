import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Conversation } from '../lib/supabase';
import { sendInteractiveMessage } from '../lib/whatsapp-api';

interface InteractiveModalProps {
  conversation: Conversation;
  getFromNumber: () => Promise<string>;
  onClose: () => void;
}

type InteractiveType = 'button' | 'list' | 'cta_url' | 'location_request_message';

export default function InteractiveModal({ conversation, getFromNumber, onClose }: InteractiveModalProps) {
  const [interactiveType, setInteractiveType] = useState<InteractiveType>('button');
  const [bodyText, setBodyText] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');

  const [buttons, setButtons] = useState<Array<{ id: string; title: string }>>([
    { id: '1', title: '' },
  ]);

  const [listSections, setListSections] = useState<
    Array<{ title: string; rows: Array<{ id: string; title: string; description: string }> }>
  >([{ title: '', rows: [{ id: '1', title: '', description: '' }] }]);
  const [listButtonText, setListButtonText] = useState('Options');

  const [ctaDisplayText, setCtaDisplayText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');


  const [sending, setSending] = useState(false);

  function addButton() {
    if (buttons.length < 3) {
      setButtons([...buttons, { id: String(buttons.length + 1), title: '' }]);
    }
  }

  function removeButton(index: number) {
    setButtons(buttons.filter((_, i) => i !== index));
  }

  function updateButton(index: number, title: string) {
    const newButtons = [...buttons];
    newButtons[index].title = title;
    setButtons(newButtons);
  }

  function addListRow(sectionIndex: number) {
    const newSections = [...listSections];
    if (newSections[sectionIndex].rows.length < 10) {
      newSections[sectionIndex].rows.push({
        id: String(newSections[sectionIndex].rows.length + 1),
        title: '',
        description: '',
      });
      setListSections(newSections);
    }
  }

  function removeListRow(sectionIndex: number, rowIndex: number) {
    const newSections = [...listSections];
    newSections[sectionIndex].rows = newSections[sectionIndex].rows.filter(
      (_, i) => i !== rowIndex
    );
    setListSections(newSections);
  }

  function updateListRow(
    sectionIndex: number,
    rowIndex: number,
    field: 'title' | 'description',
    value: string
  ) {
    const newSections = [...listSections];
    newSections[sectionIndex].rows[rowIndex][field] = value;
    setListSections(newSections);
  }

  async function handleSend() {
    if (sending) return;

    setSending(true);
    try {
      let action: any;
      let finalType = interactiveType;

      switch (interactiveType) {
        case 'button':
          if (!bodyText.trim()) {
            alert('Please enter body text');
            setSending(false);
            return;
          }
          const validButtons = buttons.filter((b) => b.title.trim());
          if (validButtons.length === 0) {
            alert('Please add at least one button');
            setSending(false);
            return;
          }
          action = {
            buttons: validButtons.map((b) => ({
              type: 'reply',
              reply: {
                id: b.id,
                title: b.title.trim(),
              },
            })),
          };
          break;

        case 'list':
          if (!bodyText.trim()) {
            alert('Please enter body text');
            setSending(false);
            return;
          }
          const validSections = listSections
            .map((section) => ({
              title: section.title.trim(),
              rows: section.rows
                .filter((row) => row.title.trim())
                .map((row) => ({
                  id: row.id,
                  title: row.title.trim(),
                  description: row.description.trim(),
                })),
            }))
            .filter((section) => section.rows.length > 0);

          if (validSections.length === 0) {
            alert('Please add at least one list item');
            setSending(false);
            return;
          }

          action = {
            button: listButtonText.trim(),
            sections: validSections,
          };
          break;

        case 'cta_url':
          if (!bodyText.trim()) {
            alert('Please enter body text');
            setSending(false);
            return;
          }
          if (!ctaDisplayText.trim() || !ctaUrl.trim()) {
            alert('Please enter both button text and URL');
            setSending(false);
            return;
          }
          action = {
            name: 'cta_url',
            parameters: {
              display_text: ctaDisplayText.trim(),
              url: ctaUrl.trim(),
            },
          };
          break;

        case 'location_request_message':
          if (!bodyText.trim()) {
            alert('Please enter body text');
            setSending(false);
            return;
          }
          action = {
            name: 'send_location',
          };
          break;

      }

      const header = headerText.trim() ? { type: 'text', text: headerText.trim() } : undefined;

      const fromNumber = await getFromNumber();
      await sendInteractiveMessage(
        fromNumber,
        conversation.phone_number,
        finalType,
        bodyText.trim(),
        action,
        header,
        footerText.trim() || undefined
      );
      onClose();
    } catch (error) {
      console.error('Error sending interactive message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Send Interactive Message</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setInteractiveType('button')}
                className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                  interactiveType === 'button'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Buttons
              </button>
              <button
                onClick={() => setInteractiveType('list')}
                className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                  interactiveType === 'list'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setInteractiveType('cta_url')}
                className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                  interactiveType === 'cta_url'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                CTA URL
              </button>
              <button
                onClick={() => setInteractiveType('location_request_message')}
                className={`px-3 py-2 text-sm border-2 rounded-lg transition-colors ${
                  interactiveType === 'location_request_message'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Location Request
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Header (optional)
            </label>
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Header text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Body Text *</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Message text..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Footer (optional)
            </label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Footer text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {interactiveType === 'button' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Buttons (max 3) *
                </label>
                {buttons.length < 3 && (
                  <button
                    onClick={addButton}
                    className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Button
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {buttons.map((button, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={button.title}
                      onChange={(e) => updateButton(index, e.target.value)}
                      placeholder={`Button ${index + 1} text`}
                      maxLength={20}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {buttons.length > 1 && (
                      <button
                        onClick={() => removeButton(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {interactiveType === 'list' && (
            <div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Button Text *
                </label>
                <input
                  type="text"
                  value={listButtonText}
                  onChange={(e) => setListButtonText(e.target.value)}
                  placeholder="Button text"
                  maxLength={20}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">List Items *</label>
              </div>
              {listSections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Section {sectionIndex + 1}
                    </span>
                    {section.rows.length < 10 && (
                      <button
                        onClick={() => addListRow(sectionIndex)}
                        className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Row
                      </button>
                    )}
                  </div>
                  {section.rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="space-y-2 p-2 bg-white rounded border border-gray-200">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) =>
                            updateListRow(sectionIndex, rowIndex, 'title', e.target.value)
                          }
                          placeholder="Row title"
                          maxLength={24}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {section.rows.length > 1 && (
                          <button
                            onClick={() => removeListRow(sectionIndex, rowIndex)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) =>
                          updateListRow(sectionIndex, rowIndex, 'description', e.target.value)
                        }
                        placeholder="Row description (optional)"
                        maxLength={72}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {interactiveType === 'cta_url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Button Text *
                </label>
                <input
                  type="text"
                  value={ctaDisplayText}
                  onChange={(e) => setCtaDisplayText(e.target.value)}
                  placeholder="e.g., Visit Website"
                  maxLength={20}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL *</label>
                <input
                  type="url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}

          {interactiveType === 'location_request_message' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                This will send a message requesting the recipient to share their location.
              </p>
            </div>
          )}
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
