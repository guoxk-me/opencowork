/**
 * UI元素类型定义
 * 位置: src/types/uiElement.ts
 */
export var ElementRole;
(function (ElementRole) {
    ElementRole["BUTTON"] = "button";
    ElementRole["INPUT"] = "input";
    ElementRole["LINK"] = "link";
    ElementRole["SELECT"] = "select";
    ElementRole["TEXTAREA"] = "textarea";
    ElementRole["CHECKBOX"] = "checkbox";
    ElementRole["RADIO"] = "radio";
    ElementRole["UNKNOWN"] = "unknown";
})(ElementRole || (ElementRole = {}));
export var ElementVisibility;
(function (ElementVisibility) {
    ElementVisibility["VISIBLE"] = "visible";
    ElementVisibility["HIDDEN"] = "hidden";
    ElementVisibility["DETACHED"] = "detached";
})(ElementVisibility || (ElementVisibility = {}));
export const DEFAULT_OBSERVER_CONFIG = {
    includeHidden: false,
    maxElements: 100,
    priorityAttributes: ['data-testid', 'id', 'aria-label', 'name', 'role'],
};
