// Action类型枚举
export var ActionType;
(function (ActionType) {
    // Browser Actions
    ActionType["BROWSER_NAVIGATE"] = "browser:navigate";
    ActionType["BROWSER_CLICK"] = "browser:click";
    ActionType["BROWSER_INPUT"] = "browser:input";
    ActionType["BROWSER_WAIT"] = "browser:wait";
    ActionType["BROWSER_EXTRACT"] = "browser:extract";
    ActionType["BROWSER_SCREENSHOT"] = "browser:screenshot";
    // CLI Actions
    ActionType["CLI_EXECUTE"] = "cli:execute";
    // Control Actions
    ActionType["ASK_USER"] = "ask:user";
})(ActionType || (ActionType = {}));
// 工具函数：生成唯一ID
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
