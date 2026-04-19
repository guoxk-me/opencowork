import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

let mockRun: any = null;
let mockResult: any = null;

vi.mock('../TaskRunRepository', () => ({
  getTaskRunRepository: () => ({
    getById: (id: string) => (mockRun?.id === id ? mockRun : null),
  }),
}));

vi.mock('../TaskResultRepository', () => ({
  getTaskResultRepository: () => ({
    getById: (id: string) => (mockResult?.id === id ? mockResult : null),
  }),
}));

import { TaskTemplateRepository } from '../TaskTemplateRepository';

describe('TaskTemplateRepository', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    mockRun = null;
    mockResult = null;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('creates a template from a successful run', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencowork-templates-'));
    const repository = new TaskTemplateRepository(path.join(tempDir, 'task-templates.json'));

    mockRun = {
      id: 'run-1',
      title: 'Find coffee vendors',
      input: {
        prompt: 'Search {{product}} vendors in {{city}}',
        params: {
          product: 'coffee',
          city: 'shenzhen',
        },
      },
      resultId: 'result-1',
      metadata: {
        recommendedSkills: ['browser-search'],
      },
    };

    mockResult = {
      id: 'result-1',
      summary: 'Found 3 coffee vendors',
      artifacts: [],
      reusable: true,
      completedAt: 1234,
    };

    const template = await repository.createFromRun('run-1');
    const savedTemplates = JSON.parse(fs.readFileSync(path.join(tempDir, 'task-templates.json'), 'utf-8'));

    expect(template.name).toBe('Find coffee vendors');
    expect(template.description).toBe('Found 3 coffee vendors');
    expect(template.defaultInput).toEqual({
      prompt: 'Search {{product}} vendors in {{city}}',
      product: 'coffee',
      city: 'shenzhen',
    });
    expect(template.inputSchema).toMatchObject({
      prompt: 'Prompt',
      product: { label: 'product', required: false },
      city: { label: 'city', required: false },
    });
    expect(template.recommendedSkills).toEqual(['browser-search']);
    expect(Array.isArray(savedTemplates)).toBe(true);
    expect(savedTemplates[0].id).toBe(template.id);
  });
});
