import { describe, it, expect } from 'vitest';
import { validateAction } from '../ActionValidator';
import { ActionType } from '../ActionSchema';

describe('ActionValidator', () => {
  describe('validateAction', () => {
    it('should validate browser:navigate action', () => {
      const action = {
        id: 'test-1',
        type: ActionType.BROWSER_NAVIGATE,
        description: 'Navigate to Google',
        params: { url: 'https://www.google.com' },
      };

      const result = validateAction(action);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject browser:navigate without url', () => {
      const action = {
        id: 'test-2',
        type: ActionType.BROWSER_NAVIGATE,
        description: 'Navigate',
        params: {},
      };

      const result = validateAction(action);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('browser:navigate requires url parameter');
    });

    it('should reject browser:navigate with invalid url', () => {
      const action = {
        id: 'test-3',
        type: ActionType.BROWSER_NAVIGATE,
        description: 'Navigate',
        params: { url: 'not-a-url' },
      };

      const result = validateAction(action);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('browser:navigate url must be a valid http/https URL');
    });

    it('should validate browser:click action', () => {
      const action = {
        id: 'test-4',
        type: ActionType.BROWSER_CLICK,
        description: 'Click button',
        params: { selector: '#submit-button' },
      };

      const result = validateAction(action);
      expect(result.valid).toBe(true);
    });

    it('should reject browser:click without selector', () => {
      const action = {
        id: 'test-5',
        type: ActionType.BROWSER_CLICK,
        description: 'Click button',
        params: {},
      };

      const result = validateAction(action);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('browser:click requires selector parameter');
    });

    it('should validate browser:input action', () => {
      const action = {
        id: 'test-6',
        type: ActionType.BROWSER_INPUT,
        description: 'Enter text',
        params: { selector: '#search', text: 'hello' },
      };

      const result = validateAction(action);
      expect(result.valid).toBe(true);
    });

    it('should validate cli:execute action', () => {
      const action = {
        id: 'test-7',
        type: ActionType.CLI_EXECUTE,
        description: 'Run git status',
        params: { command: 'git status' },
      };

      const result = validateAction(action);
      expect(result.valid).toBe(true);
    });
  });
});
