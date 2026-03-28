export var TakeoverReason;
(function (TakeoverReason) {
    TakeoverReason["USER_KEYPRESS"] = "user_keypress";
    TakeoverReason["USER_CLICK"] = "user_click";
    TakeoverReason["USER_MOUSE"] = "user_mouse";
    TakeoverReason["USER_REMOTE"] = "user_remote";
})(TakeoverReason || (TakeoverReason = {}));
export class TakeoverManager {
    takeoverState = null;
    listeners = new Set();
    triggerTakeover(reason, context = {}) {
        console.log(`[TakeoverManager] Takeover triggered:`, reason);
        this.takeoverState = {
            reason,
            timestamp: Date.now(),
            currentNode: context.currentNode || null,
            completedActions: context.completedActions || [],
            pendingNodes: context.pendingNodes || [],
            aiContext: context.aiContext || {
                currentTask: '',
                conversationHistory: [],
                variables: {},
            },
        };
        this.notifyListeners();
    }
    resumeFromTakeover(action) {
        console.log(`[TakeoverManager] Resuming from takeover`);
        if (action) {
            console.log(`[TakeoverManager] User action:`, action);
        }
        this.takeoverState = null;
        this.notifyListeners();
    }
    getTakeoverState() {
        return this.takeoverState;
    }
    isInTakeover() {
        return this.takeoverState !== null;
    }
    addListener(listener) {
        this.listeners.add(listener);
    }
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    notifyListeners() {
        this.listeners.forEach((listener) => listener(this.takeoverState));
    }
}
export default TakeoverManager;
