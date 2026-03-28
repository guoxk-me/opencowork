import {
  ActionType,
  BaseAction,
  BrowserNavigateAction,
  BrowserClickAction,
  BrowserInputAction,
  BrowserWaitAction,
  BrowserExtractAction,
  BrowserScreenshotAction,
  CLIExecuteAction,
  AskUserAction,
} from './ActionSchema';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAction(action: BaseAction): ValidationResult {
  const errors: string[] = [];

  // 验证基础字段
  if (!action.id) {
    errors.push('Action must have an id');
  }
  if (!action.type) {
    errors.push('Action must have a type');
  }

  // 根据类型验证参数
  switch (action.type) {
    case ActionType.BROWSER_NAVIGATE:
      return validateNavigate(action as BrowserNavigateAction, errors);
    case ActionType.BROWSER_CLICK:
      return validateClick(action as BrowserClickAction, errors);
    case ActionType.BROWSER_INPUT:
      return validateInput(action as BrowserInputAction, errors);
    case ActionType.BROWSER_WAIT:
      return validateWait(action as BrowserWaitAction, errors);
    case ActionType.BROWSER_EXTRACT:
      return validateExtract(action as BrowserExtractAction, errors);
    case ActionType.BROWSER_SCREENSHOT:
      return validateScreenshot(action as BrowserScreenshotAction, errors);
    case ActionType.CLI_EXECUTE:
      return validateCLI(action as CLIExecuteAction, errors);
    case ActionType.ASK_USER:
      return validateAskUser(action as AskUserAction, errors);
    default:
      errors.push(`Unknown action type: ${(action as BaseAction).type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateNavigate(action: BrowserNavigateAction, errors: string[]): ValidationResult {
  if (!action.params.url) {
    errors.push('browser:navigate requires url parameter');
  } else if (!isValidUrl(action.params.url)) {
    errors.push('browser:navigate url must be a valid http/https URL');
  }
  return { valid: errors.length === 0, errors };
}

function validateClick(action: BrowserClickAction, errors: string[]): ValidationResult {
  if (!action.params.selector) {
    errors.push('browser:click requires selector parameter');
  }
  if (action.params.index !== undefined && action.params.index < 0) {
    errors.push('browser:click index must be non-negative');
  }
  return { valid: errors.length === 0, errors };
}

function validateInput(action: BrowserInputAction, errors: string[]): ValidationResult {
  if (!action.params.selector) {
    errors.push('browser:input requires selector parameter');
  }
  if (action.params.text === undefined) {
    errors.push('browser:input requires text parameter');
  }
  return { valid: errors.length === 0, errors };
}

function validateWait(action: BrowserWaitAction, errors: string[]): ValidationResult {
  if (!action.params.selector && !action.params.timeout) {
    errors.push('browser:wait requires either selector or timeout parameter');
  }
  return { valid: errors.length === 0, errors };
}

function validateExtract(action: BrowserExtractAction, errors: string[]): ValidationResult {
  if (!action.params.selector) {
    errors.push('browser:extract requires selector parameter');
  }
  if (!['text', 'html', 'table', 'json'].includes(action.params.type)) {
    errors.push('browser:extract type must be one of: text, html, table, json');
  }
  return { valid: errors.length === 0, errors };
}

function validateScreenshot(action: BrowserScreenshotAction, errors: string[]): ValidationResult {
  // screenshot 暂无必需参数
  return { valid: errors.length === 0, errors };
}

function validateCLI(action: CLIExecuteAction, errors: string[]): ValidationResult {
  if (!action.params.command) {
    errors.push('cli:execute requires command parameter');
  }
  return { valid: errors.length === 0, errors };
}

function validateAskUser(action: AskUserAction, errors: string[]): ValidationResult {
  if (!action.params.question) {
    errors.push('ask:user requires question parameter');
  }
  return { valid: errors.length === 0, errors };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
