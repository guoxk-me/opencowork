import { beforeEach, describe, expect, it } from 'vitest';
import { useTaskStore } from '../taskStore';
describe('taskStore streaming messages', () => {
    beforeEach(() => {
        const store = useTaskStore.getState();
        store.clearMessages();
        store.resetStreamingMessage();
    });
    it('keeps the active streaming id when the stream is finalized for completion', () => {
        const store = useTaskStore.getState();
        store.beginStreamingMessage();
        store.appendToStreamingMessage('hello');
        store.finalizeStreamingMessage();
        const state = useTaskStore.getState();
        expect(state.streamingMessageId).not.toBeNull();
        expect(state.messages[0]).toMatchObject({
            content: 'hello',
            streaming: false,
        });
    });
    it('can reset a failed stream so the next stream creates a new message', () => {
        const store = useTaskStore.getState();
        store.beginStreamingMessage();
        store.appendToStreamingMessage('partial');
        const firstMessageId = useTaskStore.getState().streamingMessageId;
        store.resetStreamingMessage();
        store.beginStreamingMessage();
        store.appendToStreamingMessage('fresh');
        const state = useTaskStore.getState();
        expect(state.streamingMessageId).not.toBe(firstMessageId);
        expect(state.messages.map((message) => message.content)).toEqual(['partial', 'fresh']);
        expect(state.messages.every((message) => message.streaming !== true)).toBe(false);
    });
    it('uses the final message content when consuming a stream', () => {
        const store = useTaskStore.getState();
        store.beginStreamingMessage();
        store.appendToStreamingMessage('partial');
        store.consumeStreamingMessage([], 'complete answer');
        const state = useTaskStore.getState();
        expect(state.streamingMessageId).toBeNull();
        expect(state.messages[0]).toMatchObject({
            content: 'complete answer',
            streaming: false,
        });
    });
});
