import { useState } from 'react';
import { X, Send, Image, Video, FileText } from 'lucide-react';

interface MediaCaptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (caption: string) => void;
  mediaType: 'image' | 'video' | 'document';
  mediaUrl?: string;
  fileName?: string;
}

export default function MediaCaptionModal({
  isOpen,
  onClose,
  onSend,
  mediaType,
  mediaUrl,
  fileName,
}: MediaCaptionModalProps) {
  const [caption, setCaption] = useState('');

  if (!isOpen) return null;

  const handleSend = () => {
    onSend(caption);
    setCaption('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add Caption</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 flex items-center justify-center bg-gray-100 rounded-lg p-8">
            {mediaType === 'image' && mediaUrl && (
              <img
                src={mediaUrl}
                alt="Preview"
                className="max-w-full max-h-64 object-contain rounded"
              />
            )}
            {mediaType === 'video' && mediaUrl && (
              <video
                src={mediaUrl}
                className="max-w-full max-h-64 rounded"
                controls
              />
            )}
            {mediaType === 'document' && (
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">{fileName || 'Document'}</p>
              </div>
            )}
            {!mediaUrl && mediaType === 'image' && (
              <div className="text-center">
                <Image className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Image selected</p>
              </div>
            )}
            {!mediaUrl && mediaType === 'video' && (
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Video selected</p>
              </div>
            )}
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            rows={3}
            autoFocus
          />
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
