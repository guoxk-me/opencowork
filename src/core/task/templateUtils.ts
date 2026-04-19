import { TaskTemplate, TaskTemplateInputField } from './types';

export interface NormalizedTemplateInputField {
  key: string;
  type: 'string';
  label: string;
  placeholder?: string;
  required: boolean;
  defaultValue: string;
}

export interface TemplateInputValidationResult {
  valid: boolean;
  missingFields: string[];
  params: Record<string, unknown>;
}

export function getTemplateInputFields(template: TaskTemplate): NormalizedTemplateInputField[] {
  const schema = template.inputSchema || {};

  return Object.entries(schema)
    .filter(([key]) => key !== 'prompt')
    .map(([key, value]) => {
      const field = typeof value === 'string' ? ({ label: value } as TaskTemplateInputField) : value || {};
      const defaultValue = template.defaultInput?.[key];
      return {
        key,
        type: 'string' as const,
        label: field.label || key,
        placeholder: field.placeholder,
        required: field.required !== false,
        defaultValue: typeof defaultValue === 'string' ? defaultValue : '',
      };
    });
}

export function validateTemplateInput(
  template: TaskTemplate,
  input?: Record<string, unknown>
): TemplateInputValidationResult {
  const mergedInput: Record<string, unknown> = {
    ...(template.defaultInput || {}),
    ...(input || {}),
  };

  const missingFields: string[] = [];
  for (const field of getTemplateInputFields(template)) {
    const value = mergedInput[field.key];
    const isMissing =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim().length === 0);
    if (field.required && isMissing) {
      missingFields.push(field.key);
    }
  }

  const promptTemplate =
    (typeof mergedInput.prompt === 'string' && mergedInput.prompt.trim()) ||
    template.description.trim();
  if (!promptTemplate) {
    missingFields.push('prompt');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    params: mergedInput,
  };
}

export function resolveTemplateInput(
  template: TaskTemplate,
  input?: Record<string, unknown>
): { prompt: string; params: Record<string, unknown> } {
  const validation = validateTemplateInput(template, input);
  if (!validation.valid) {
    throw new Error(`Missing required template input(s): ${validation.missingFields.join(', ')}`);
  }

  const mergedInput = validation.params;

  const promptTemplate =
    (typeof mergedInput.prompt === 'string' && mergedInput.prompt) || template.description || '';

  const prompt = promptTemplate.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    const value = mergedInput[key];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });

  return {
    prompt,
    params: mergedInput,
  };
}
