/**
 * UI元素类型定义
 * 位置: src/types/uiElement.ts
 */

export enum ElementRole {
  BUTTON = 'button',
  INPUT = 'input',
  LINK = 'link',
  SELECT = 'select',
  TEXTAREA = 'textarea',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  UNKNOWN = 'unknown',
}

export enum ElementVisibility {
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
  DETACHED = 'detached',
}

export interface UIElement {
  id: string;
  role: ElementRole;
  label: string;
  selector: string;
  selectorPriority: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visibility: ElementVisibility;
  disabled: boolean;
  parentContext: string;
  attributes: Record<string, string>;
}

export interface UIGraph {
  url: string;
  title: string;
  timestamp: number;
  elements: UIElement[];
  navigation: UIElement[];
  inputs: UIElement[];
  actions: UIElement[];
  content: UIElement[];
}

export interface ObserverConfig {
  includeHidden: boolean;
  maxElements: number;
  priorityAttributes: string[];
}

export const DEFAULT_OBSERVER_CONFIG: ObserverConfig = {
  includeHidden: false,
  maxElements: 100,
  priorityAttributes: ['data-testid', 'id', 'aria-label', 'name', 'role'],
};
