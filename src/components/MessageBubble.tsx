import { Check, CheckCheck, Clock, AlertCircle, MapPin, Phone, Mail, Download, Play, Copy, Reply, Smile, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Message } from '../lib/supabase';

interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  onMediaClick?: (mediaUrl: string, mediaType: 'image' | 'video' | 'document', caption?: string, filename?: string) => void;
}

export default function MessageBubble({ message, onReply, onReact, onMediaClick }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  function handleCopyMessage() {
    let textToCopy = '';

    if (message.message_type === 'text') {
      textToCopy = message.content.text;
    } else if (message.message_type === 'location') {
      textToCopy = `${message.content.name || ''} ${message.content.address || ''} (${message.content.latitude}, ${message.content.longitude})`;
    } else if (message.content.caption) {
      textToCopy = message.content.caption;
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
    }
  }

  function formatTime(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function renderStatusIcon() {
    if (message.isPending) {
      return <Clock className="w-4 h-4 animate-spin opacity-60" />;
    }

    switch (message.status) {
      case 'pending':
        return <Clock className="w-4 h-4 animate-spin opacity-60" />;
      case 'sent':
        return <Check className="w-4 h-4" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  }

  function renderMessageContent() {
    switch (message.message_type) {
      case 'text':
        return (
          <p className="whitespace-pre-wrap break-words">{message.content.text}</p>
        );

      case 'image':
        return (
          <div>
            <img
              src={message.content.link}
              alt="Shared image"
              className="max-w-[200px] md:max-w-xs rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onMediaClick?.(message.content.link, 'image', message.content.caption)}
            />
            {message.content.caption && (
              <p className="text-sm">{message.content.caption}</p>
            )}
          </div>
        );

      case 'sticker':
        return (
          <div className="bg-transparent">
            <img
              src={message.content.link}
              alt="Sticker"
              className="w-32 h-32 object-contain"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
        );

      case 'video':
        {
          const url: string = message.content.link;
          const isExternalPage = /youtube\.com|youtu\.be|instagram\.com/.test(url);
          const isMedia = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url);
          if (isExternalPage || !isMedia) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open video
              </a>
            );
          }
          if (mediaFailed) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open video
              </a>
            );
          }
          return (
            <div>
              <div
                className="relative max-w-xs rounded-lg overflow-hidden mb-2 bg-black cursor-pointer"
                onClick={() => onMediaClick?.(url, 'video', message.content.caption)}
              >
                <video
                  src={url}
                  className="w-full"
                  crossOrigin="anonymous"
                  controls
                  onError={() => setMediaFailed(true)}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-20 transition-all">
                  <Play className="w-12 h-12 text-white" />
                </div>
              </div>
              {message.content.caption && (
                <p className="text-sm">{message.content.caption}</p>
              )}
            </div>
          );
        }

      case 'audio':
        {
          const url: string = message.content.link;
          const isMedia = /\.(ogg|mp3|aac|amr|m4a|wav|webm)(\?.*)?$/i.test(url);
          if (!isMedia) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open audio
              </a>
            );
          }
          if (mediaFailed) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open audio
              </a>
            );
          }
          return (
            <div className="flex items-center gap-3">
              <Play className="w-5 h-5" />
              <audio src={url} controls className="max-w-xs" crossOrigin="anonymous" onError={() => setMediaFailed(true)} />
            </div>
          );
        }

      case 'document':
        return (
          <div
            className="flex items-center gap-3 p-3 bg-white bg-opacity-20 rounded-lg cursor-pointer hover:bg-opacity-30 transition-all"
            onClick={() => onMediaClick?.(message.content.link, 'document', message.content.caption, message.content.filename)}
          >
            <Download className="w-5 h-5" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {message.content.filename || 'Document'}
              </p>
              {message.content.caption && (
                <p className="text-xs mt-1">{message.content.caption}</p>
              )}
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 mt-0.5" />
              <div>
                {message.content.name && (
                  <p className="font-medium">{message.content.name}</p>
                )}
                {message.content.address && (
                  <p className="text-sm">{message.content.address}</p>
                )}
                <p className="text-xs mt-1 opacity-75">
                  {message.content.latitude}, {message.content.longitude}
                </p>
              </div>
            </div>
            <a
              href={`https://www.google.com/maps?q=${message.content.latitude},${message.content.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline inline-block"
            >
              View on map
            </a>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-2">
            {message.content.contacts?.map((contact: any, idx: number) => (
              <div key={idx} className="p-3 bg-white bg-opacity-20 rounded-lg">
                <p className="font-medium">
                  {contact.name?.formatted_name || 'Contact'}
                </p>
                {contact.phones?.map((phone: any, phoneIdx: number) => (
                  <div key={phoneIdx} className="flex items-center gap-2 text-sm mt-1">
                    <Phone className="w-4 h-4" />
                    <span>{phone.phone}</span>
                  </div>
                ))}
                {contact.emails?.map((email: any, emailIdx: number) => (
                  <div key={emailIdx} className="flex items-center gap-2 text-sm mt-1">
                    <Mail className="w-4 h-4" />
                    <span>{email.email}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      case 'interactive':
        const interactiveType = message.content.interactive?.type || message.content.type;
        const interactiveData = message.content.interactive || message.content;

        return (
          <div>
            {message.content.button_reply || interactiveData.button_reply ? (
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-75">Selected:</span>
                <span className="font-medium">{message.content.button_reply?.title || interactiveData.button_reply?.title}</span>
              </div>
            ) : message.content.list_reply || interactiveData.list_reply ? (
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-75">Selected:</span>
                <span className="font-medium">{message.content.list_reply?.title || interactiveData.list_reply?.title}</span>
              </div>
            ) : interactiveType === 'location_request_message' ? (
              <div className="-mx-3 -my-2 min-w-[280px]">
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-white text-lg font-normal flex-1">{interactiveData.body?.text || 'send me'}</p>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(message.timestamp)}</span>
                  </div>
                </div>
                <div className="border-t border-[#3A4B57]">
                  <button className="w-full flex items-center justify-center gap-3 py-4 bg-[#36454F] hover:bg-[#3d4f5a] transition-colors">
                    <MapPin className="w-6 h-6 text-[#25D366]" />
                    <span className="text-[#25D366] font-semibold text-lg">Send Location</span>
                  </button>
                </div>
              </div>
            ) : interactiveType === 'cta_url' ? (
              <div className="-mx-3 -my-2">
                {interactiveData.body?.text && (
                  <div className="px-3 py-2">
                    <p className="text-sm text-gray-900">{interactiveData.body.text}</p>
                  </div>
                )}
                {interactiveData.action?.parameters && (
                  <div className="border-t border-gray-200">
                    <a
                      href={interactiveData.action.parameters.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 text-[#0B93F6] hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{interactiveData.action.parameters.display_text || 'website'}</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <>
                {message.content.header?.text && (
                  <p className="font-semibold text-base mb-2">{message.content.header.text}</p>
                )}
                {message.content.body_text && (
                  <p className="text-sm leading-snug mb-1">{message.content.body_text}</p>
                )}
                {message.content.footer_text && (
                  <p className="text-xs opacity-70 mb-3">{message.content.footer_text}</p>
                )}
                {message.content.action?.buttons && (
                  <div className="mt-3 space-y-0 -mx-3 -mb-2 border-t border-gray-200">
                    {message.content.action.buttons.map((button: any, idx: number) => (
                      <button
                        key={idx}
                        className={`w-full px-4 py-2.5 text-center text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          idx < message.content.action.buttons.length - 1 ? 'border-b border-gray-200' : ''
                        } ${isOutbound ? 'text-green-700 hover:bg-green-50' : 'text-green-600 hover:bg-gray-50'}`}
                      >
                        <Reply className="w-4 h-4" />
                        <span>{button.reply?.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'template':
        return (
          <div className="space-y-2">
            <p className="text-sm opacity-75">Template: {message.content.name}</p>
            <p>Template message sent</p>
          </div>
        );

      case 'reaction':
        return (
          <div className="flex items-center gap-2">
            <span className="text-2xl">{message.content.emoji}</span>
            <span className="text-sm opacity-75">Reacted to message</span>
          </div>
        );

      default:
        return (
          <div>
            <p className="text-sm opacity-75">Message type: {message.message_type}</p>
            {message.content && typeof message.content === 'object' && (
              <pre className="text-xs mt-2 opacity-75 whitespace-pre-wrap break-all">
                {JSON.stringify(message.content, null, 2)}
              </pre>
            )}
          </div>
        );
    }
  }

  function getReplyPreview(): string {
    if (!message.context) return '';

    if (message.context.text) return message.context.text;
    if (message.context.type === 'image') return '📷 Photo';
    if (message.context.type === 'video') return '🎥 Video';
    if (message.context.type === 'audio') return '🎵 Audio';
    if (message.context.type === 'document') return '📄 Document';
    if (message.context.type === 'location') return '📍 Location';
    if (message.context.type === 'contact') return '👤 Contact';
    if (message.context.type === 'sticker') return '🎨 Sticker';

    return 'Message';
  }

  const interactiveType = message.message_type === 'interactive'
    ? (message.content.interactive?.type || message.content.type)
    : null;

  const isLocationRequest = interactiveType === 'location_request_message';
  const isCtaUrl = interactiveType === 'cta_url';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2 group`}>
      <div
        className={`max-w-[65%] ${message.message_type === 'sticker' ? 'bg-transparent shadow-none p-0' : 'px-3 py-2 shadow-sm'} rounded-lg relative ${
          message.message_type === 'sticker' ? '' :
          isLocationRequest
            ? `bg-[#2C3E50] text-white ${isOutbound ? 'rounded-br-none' : 'rounded-bl-none'} border-0`
            : isCtaUrl
              ? `bg-white text-gray-900 border-2 border-[#C8B6FF] ${isOutbound ? 'rounded-br-none' : 'rounded-bl-none'}`
              : isOutbound
                ? 'bg-[#d9fdd3] text-gray-900 rounded-br-none'
                : 'bg-white text-gray-900 rounded-bl-none'
        }`}
      >
        <div className={`absolute top-0 ${isOutbound ? '-left-32' : '-right-32'} flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200`}>
          {/* Only allow reactions to inbound messages */}
          {!isOutbound && message.message_id?.startsWith('wamid.') && (
            <div className="relative">
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 shadow-lg transform hover:scale-110 transition-transform"
                title="React"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showReactionPicker && (
                <div className="absolute top-full mt-2 bg-white rounded-lg shadow-xl p-2 flex gap-1 z-20">
                  {quickReactions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact?.(message, emoji);
                        setShowReactionPicker(false);
                      }}
                      className="text-2xl hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleCopyMessage}
            className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 shadow-lg transform hover:scale-110 transition-transform"
            title="Copy message"
          >
            <Copy className="w-4 h-4" />
          </button>
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 shadow-lg transform hover:scale-110 transition-transform"
              title="Reply to message"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
        </div>

        {message.context && (
          <div className={`mb-2 pl-2 py-1 border-l-[3px] ${
            isOutbound
              ? 'border-green-700 bg-green-50 bg-opacity-60'
              : 'border-green-600 bg-gray-50'
          } rounded-sm`}>
            <div className="text-[11px] font-semibold leading-tight text-green-700">
              {message.direction === 'inbound' ? 'You' : 'Them'}
            </div>
            <div className="text-[13px] leading-snug truncate text-gray-600">
              {getReplyPreview()}
            </div>
          </div>
        )}

        {renderMessageContent()}
        {message.message_type !== 'sticker' && !isLocationRequest && (
          <div className="flex items-center justify-end gap-1 mt-1 text-xs text-gray-500">
            <span>{formatTime(message.timestamp)}</span>
            {isOutbound && renderStatusIcon()}
          </div>
        )}
      </div>
    </div>
  );
}
