/**
 * Verifier类型定义
 * 位置: src/types/verifier.ts
 */

export enum VerificationType {
  URL_CHANGE = 'url_change',
  URL_MATCH = 'url_match',
  ELEMENT_VISIBLE = 'element_visible',
  ELEMENT_HIDDEN = 'element_hidden',
  ELEMENT_CONTAINS = 'element_contains',
  NETWORK_IDLE = 'network_idle',
  DOM_STABLE = 'dom_stable',
}

export interface VerificationResult {
  verified: boolean;
  type: VerificationType;
  expected?: string;
  actual?: string;
  message?: string;
}
