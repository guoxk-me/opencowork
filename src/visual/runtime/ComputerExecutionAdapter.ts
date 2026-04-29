import {
  ActionExecutionResult,
  UIAction,
  VisualObservation,
  VisualPageContext,
} from '../types/visualProtocol';

export interface ComputerExecutionTarget {
  kind: 'browser' | 'desktop' | 'hybrid';
  environment: 'playwright' | 'vm' | 'container' | 'native-bridge';
}

export type DesktopActionType =
  | 'open_application'
  | 'focus_window'
  | 'open_file'
  | 'save_file'
  | 'upload_file'
  | 'download_file';

export interface DesktopActionContract {
  supportedActions: DesktopActionType[];
  supportedOperations: Array<'application' | 'window' | 'file' | 'transfer'>;
  notes: string[];
  workflowSemantics?: Array<{
    action: DesktopActionType;
    summary: string;
    examples?: string[];
  }>;
}

export interface ComputerExecutionAdapter {
  prepare?(): Promise<void>;

  captureObservation(): Promise<VisualObservation>;

  executeActions(actions: UIAction[]): Promise<ActionExecutionResult>;

  getPageContext(): Promise<VisualPageContext>;

  getExecutionTarget(): Promise<ComputerExecutionTarget>;

  getExecutionContext(): Promise<Record<string, unknown>>;

  getActionContract?(): Promise<DesktopActionContract | null>;

  restart?(): Promise<void>;

  cleanup?(): Promise<void>;
}
