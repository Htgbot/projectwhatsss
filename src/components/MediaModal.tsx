import { useState } from 'react';
import { X, Image, Video, Music, FileText } from 'lucide-react';
import { Conversation } from '../lib/supabase';
import { sendMediaMessage } from '../lib/whatsapp-api';

interface MediaModalProps {
  conversation: Conversation;
  getFromNumber: () => Promise<string>;
  onClose: () => void;
}

export default function MediaModal({ conversation, getFromNumber, onClose }: MediaModalProps) {
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');
  const [mediaLink, setMediaLink] = useState('');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!mediaLink.trim() || sending) return;

    setSending(true);
    try {
      const fromNumber = await getFromNumber();
      await sendMediaMessage(
        fromNumber,
        conversation.phone_number,
        mediaType,
        mediaLink.trim(),
        caption.trim() || undefined
      );
      onClose();
    } catch (error) {
      console.error('Error sending media:', error);
      alert('Failed to send media. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Send Media</h2>
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
              Media Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { type: 'image', icon: Image, label: 'Image' },
                { type: 'video', icon: Video, label: 'Video' },
                { type: 'audio', icon: Music, label: 'Audio' },
                { type: 'document', icon: FileText, label: 'Document' },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => setMediaType(item.type as any)}
                  className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                    mediaType === item.type
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Media URL
            </label>
            <input
              type="url"
              value={mediaLink}
              onChange={(e) => setMediaLink(e.target.value)}
              placeholder="https://example.com/media.jpg"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter a publicly accessible URL to the media file
            </p>
          </div>

          {mediaType !== 'audio' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Caption (optional)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
              />
            </div>
          )}

          {mediaLink && mediaType === 'image' && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
              <img
                src={mediaLink}
                alt="Preview"
                className="max-w-full rounded-lg"
                onError={() => alert('Invalid image URL')}
              />
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
            disabled={!mediaLink.trim() || sending}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
