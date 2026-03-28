import React from 'react';
import { Message } from '../stores/taskStore';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`${isUser ? 'message-user' : 'message-ai'}`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <span className="text-xs text-white/50 mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
