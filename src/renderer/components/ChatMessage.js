import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    return (_jsx("div", { className: `flex ${isUser ? 'justify-end' : 'justify-start'}`, children: _jsxs("div", { className: `${isUser ? 'message-user' : 'message-ai'}`, children: [_jsx("p", { className: "text-sm whitespace-pre-wrap", children: message.content }), _jsx("span", { className: "text-xs text-white/50 mt-1 block", children: new Date(message.timestamp).toLocaleTimeString() })] }) }));
}
