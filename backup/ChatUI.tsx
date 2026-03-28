import React, { useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useTaskStore } from '../stores/taskStore';

export function ChatUI() {
  const { messages } = useTaskStore();

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-text-muted">
              <p className="text-lg mb-2">Welcome to OpenCowork</p>
              <p className="text-sm">Describe a task and I'll help you execute it</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border">
        <ChatInput />
      </div>
    </div>
  );
}
