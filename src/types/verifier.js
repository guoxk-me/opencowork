/**
 * Verifier类型定义
 * 位置: src/types/verifier.ts
 */
export var VerificationType;
(function (VerificationType) {
    VerificationType["URL_CHANGE"] = "url_change";
    VerificationType["URL_MATCH"] = "url_match";
    VerificationType["ELEMENT_VISIBLE"] = "element_visible";
    VerificationType["ELEMENT_HIDDEN"] = "element_hidden";
    VerificationType["ELEMENT_CONTAINS"] = "element_contains";
    VerificationType["NETWORK_IDLE"] = "network_idle";
    VerificationType["DOM_STABLE"] = "dom_stable";
})(VerificationType || (VerificationType = {}));
