import { X, Download } from 'lucide-react';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'document';
  caption?: string;
  filename?: string;
}

export default function MediaPreviewModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  caption,
  filename,
}: MediaPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>

      <a
        href={mediaUrl}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 left-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition-colors z-10"
      >
        <Download className="w-6 h-6" />
      </a>

      <div className="max-w-7xl max-h-[90vh] w-full mx-4 flex flex-col items-center justify-center">
        {mediaType === 'image' && (
          <img
            src={mediaUrl}
            alt="Preview"
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}

        {mediaType === 'video' && (
          /youtube\.com|youtu\.be|instagram\.com/.test(mediaUrl) || !/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(mediaUrl) ? (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Open video
            </a>
          ) : (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded-lg"
              crossOrigin="anonymous"
              onError={(e) => {
                const a = document.createElement('a');
                a.href = mediaUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.click();
              }}
            />
          )
        )}

        {mediaType === 'document' && (
          <div className="bg-white rounded-lg p-8 text-center">
            <Download className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">{filename || 'Document'}</p>
            <a
              href={mediaUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Download File
            </a>
          </div>
        )}

        {caption && (
          <div className="mt-4 bg-black bg-opacity-60 px-4 py-2 rounded-lg text-white text-center max-w-2xl">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
