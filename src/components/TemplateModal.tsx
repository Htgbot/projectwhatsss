import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supabase, Conversation, Template } from '../lib/supabase';
import { sendTemplateMessage } from '../lib/whatsapp-api';

interface TemplateModalProps {
  conversation: Conversation;
  getFromNumber: () => Promise<string>;
  onClose: () => void;
}

export default function TemplateModal({ conversation, getFromNumber, onClose }: TemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleTemplateSelect(template: Template) {
    setSelectedTemplate(template);

    if (template.content.components) {
      setComponents(template.content.components.map((comp: any) => ({
        type: comp.type,
        parameters: comp.parameters || [],
      })));
    } else {
      setComponents([]);
    }
  }

  function updateParameter(compIndex: number, paramIndex: number, value: string) {
    const newComponents = [...components];
    if (!newComponents[compIndex].parameters) {
      newComponents[compIndex].parameters = [];
    }
    newComponents[compIndex].parameters[paramIndex] = {
      type: 'text',
      text: value,
    };
    setComponents(newComponents);
  }

  async function handleSend() {
    if (!selectedTemplate || sending) return;

    setSending(true);
    try {
      const fromNumber = await getFromNumber();
      await sendTemplateMessage(
        fromNumber,
        conversation.phone_number,
        selectedTemplate.name,
        selectedTemplate.language,
        components
      );
      onClose();
    } catch (error) {
      console.error('Error sending template:', error);
      alert('Failed to send template. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Send Template Message</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No templates available</p>
              <p className="text-sm mt-2">
                Templates need to be pre-approved by WhatsApp
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Template
                </label>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{template.name}</h3>
                          <p className="text-sm text-gray-500">
                            {template.category} • {template.language}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplate && components.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Variables
                  </label>
                  <div className="space-y-3">
                    {components.map((component, compIndex) => (
                      <div key={compIndex} className="space-y-2">
                        {component.parameters &&
                          component.parameters.map((param: any, paramIndex: number) => (
                            <div key={paramIndex}>
                              <label className="block text-xs text-gray-600 mb-1">
                                Variable {paramIndex + 1}
                              </label>
                              <input
                                type="text"
                                value={param.text || ''}
                                onChange={(e) =>
                                  updateParameter(compIndex, paramIndex, e.target.value)
                                }
                                placeholder={`Enter value for variable ${paramIndex + 1}`}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTemplate && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Template Preview:</p>
                  <div className="text-sm text-gray-800">
                    <pre className="whitespace-pre-wrap font-sans">
                      {JSON.stringify(selectedTemplate.content, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
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
            disabled={!selectedTemplate || sending}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
