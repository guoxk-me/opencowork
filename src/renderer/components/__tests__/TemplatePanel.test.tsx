import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runTemplate = vi.fn();
const prepareDraftFromTemplate = vi.fn();

async function loadTemplatePanel(): Promise<any> {
  // @ts-expect-error Explicit TSX import avoids stale JS sidecars.
  return import('../TemplatePanel.tsx');
}

vi.mock('../../stores/historyStore', () => ({
  useHistoryStore: () => ({
    runTemplate,
  }),
}));

vi.mock('../../stores/schedulerStore', () => ({
  useSchedulerStore: () => ({
    prepareDraftFromTemplate,
  }),
}));

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('TemplatePanel', () => {
  const invoke = vi.fn();
  const writeText = vi.fn().mockResolvedValue(undefined);
  let workflowPackInstalled = false;

  beforeEach(() => {
    vi.clearAllMocks();
    workflowPackInstalled = false;
    invoke.mockImplementation((channel: string) => {
      if (channel === 'template:list') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'template-1',
              name: 'Visual Template',
              description: 'Run a visual browser task',
              origin: {
                runId: 'run-1',
                source: 'chat',
                executionMode: 'visual',
              },
              inputSchema: { prompt: 'Prompt' },
              defaultInput: { prompt: 'Open the menu and click publish' },
              executionProfile: 'mixed',
              createdAt: 1710000000000,
              updatedAt: 1710000000000,
            },
            ...(workflowPackInstalled
              ? [
                  {
                    id: 'workflow-pack-ecommerce-ops-catalog-audit',
                    name: 'Catalog Audit Sweep',
                    description: 'Audit',
                    origin: {
                      runId: 'ecommerce-ops:catalog-audit',
                      source: 'chat',
                      executionMode: 'hybrid',
                    },
                    inputSchema: { prompt: 'Prompt' },
                    defaultInput: { prompt: 'Audit current store backend' },
                    executionProfile: 'mixed',
                    createdAt: 1710000001000,
                    updatedAt: 1710000001000,
                  },
                  {
                    id: 'workflow-pack-ecommerce-ops-campaign-qa',
                    name: 'Promotion Campaign QA',
                    description: 'Validate',
                    origin: {
                      runId: 'ecommerce-ops:campaign-qa',
                      source: 'chat',
                      executionMode: 'hybrid',
                    },
                    inputSchema: { prompt: 'Prompt' },
                    defaultInput: { prompt: 'Review the active promotion workflow' },
                    executionProfile: 'mixed',
                    createdAt: 1710000001000,
                    updatedAt: 1710000001000,
                  },
                ]
              : []),
          ],
        });
      }

      if (channel === 'workflow-pack:list') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'ecommerce-ops',
              name: 'E-commerce Ops',
              category: 'browser-heavy',
              description: 'Pack',
              summary: 'Catalog and campaign workflows',
              outcomes: ['Catalog audit notes'],
              recommendedSkills: ['browser-search'],
              templates: [
                {
                  id: 'catalog-audit',
                  name: 'Catalog Audit Sweep',
                  description: 'Audit',
                  prompt: 'Audit current store backend',
                  executionProfile: 'mixed',
                },
              ],
            },
            {
              id: 'saas-admin',
              name: 'SaaS Admin Ops',
              category: 'browser-heavy',
              description: 'Pack',
              summary: 'Admin console workflows',
              outcomes: ['Tenant health summary'],
              recommendedSkills: ['browser-search'],
              templates: [
                {
                  id: 'tenant-health-check',
                  name: 'Tenant Health Check',
                  description: 'Audit',
                  prompt: 'Inspect the current SaaS admin console',
                  executionProfile: 'browser-first',
                },
              ],
            },
          ],
        });
      }

      if (channel === 'workflow-pack:install') {
        workflowPackInstalled = true;
        return Promise.resolve({
          success: true,
          data: {
            packId: 'ecommerce-ops',
            installedTemplateIds: ['workflow-pack-ecommerce-ops-catalog-audit'],
            installedCount: 1,
            selectedTemplateId: 'template-1',
          },
        });
      }

      if (channel === 'template:update' || channel === 'template:delete') {
        return Promise.resolve({ success: true });
      }

      return Promise.resolve({ success: true, data: [] });
    });
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        invoke,
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });
  });

  it('defaults mixed templates to hybrid mode when running', async () => {
    const { TemplatePanel } = await loadTemplatePanel();

    render(<TemplatePanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Visual Template')).toBeInTheDocument();
    });

    expect(screen.getByText('Template origin')).toBeInTheDocument();
    expect(screen.getByText('run-1')).toBeInTheDocument();

    const executionModeLabel = screen.getByText('taskPanels.executionMode');
    const executionModeSelect = executionModeLabel.parentElement?.querySelector('select') as HTMLSelectElement;
    await waitFor(() => {
      expect(executionModeSelect.value).toBe('hybrid');
    });

    fireEvent.click(screen.getByRole('button', { name: 'taskPanels.runTemplate' }));

    expect(runTemplate).toHaveBeenCalledWith(
      'template-1',
      {
        prompt: 'Open the menu and click publish',
      },
      'hybrid'
    );
  });

  it('refreshes templates when a template changes', async () => {
    const { TemplatePanel } = await loadTemplatePanel();

    render(<TemplatePanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('template:list');
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('template:changed', { detail: { templateId: 'template-1' } }));
    });

    await waitFor(() => {
      expect(invoke.mock.calls.filter(([channel]) => channel === 'template:list').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('copies the template id from the details panel', async () => {
    const { TemplatePanel } = await loadTemplatePanel();

    render(<TemplatePanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Visual Template')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'taskPanels.copyId' }));

    expect(writeText).toHaveBeenCalledWith('template-1');
  });

  it('lists workflow packs and installs one into templates', async () => {
    const { TemplatePanel } = await loadTemplatePanel();

    render(<TemplatePanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('E-commerce Ops')).toBeInTheDocument();
    });

    expect(screen.getByText('Catalog audit notes')).toBeInTheDocument();

    const ecommercePackCard = screen.getByText('E-commerce Ops').closest('.rounded-xl');
    expect(ecommercePackCard).not.toBeNull();
    fireEvent.click(
      within(ecommercePackCard as HTMLElement).getByRole('button', {
        name: /taskPanels\.(installPack|reinstallPack)/,
      })
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('workflow-pack:install', { packId: 'ecommerce-ops' });
    });

    expect(screen.getByText('E-commerce Ops: installed 1 templates')).toBeInTheDocument();

    expect(
      invoke.mock.calls.filter(([channel]) => channel === 'template:list').length
    ).toBeGreaterThanOrEqual(2);
  });

  it('filters workflow packs by the shared search box', async () => {
    const { TemplatePanel } = await loadTemplatePanel();

    render(<TemplatePanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('E-commerce Ops')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('taskPanels.searchTemplates'), {
      target: { value: 'zzz' },
    });

    expect(screen.queryByText('E-commerce Ops')).not.toBeInTheDocument();
    expect(screen.getByText('taskPanels.noWorkflowPacksMatch')).toBeInTheDocument();
  });

  it('marks workflow packs as installed after install', async () => {
    const { TemplatePanel } = await loadTemplatePanel();

    render(<TemplatePanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('E-commerce Ops')).toBeInTheDocument();
    });

    const ecommercePackCard = screen.getByText('E-commerce Ops').closest('.rounded-xl');
    expect(ecommercePackCard).not.toBeNull();
    fireEvent.click(
      within(ecommercePackCard as HTMLElement).getByRole('button', {
        name: /taskPanels\.(installPack|reinstallPack)/,
      })
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'taskPanels.reinstallPack' })).toBeInTheDocument();
    });
  });

  it('filters workflow packs to installed only when requested', async () => {
    const { TemplatePanel } = await loadTemplatePanel();

    render(<TemplatePanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('E-commerce Ops')).toBeInTheDocument();
      expect(screen.getByText('SaaS Admin Ops')).toBeInTheDocument();
    });

    const ecommercePackCard = screen.getByText('E-commerce Ops').closest('.rounded-xl');
    expect(ecommercePackCard).not.toBeNull();
    fireEvent.click(
      within(ecommercePackCard as HTMLElement).getByRole('button', {
        name: /taskPanels\.(installPack|reinstallPack)/,
      })
    );

    await waitFor(() => {
      expect(screen.getByText('E-commerce Ops: installed 1 templates')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Installed only' }));

    expect(screen.getByText('E-commerce Ops')).toBeInTheDocument();
    expect(screen.queryByText('SaaS Admin Ops')).not.toBeInTheDocument();
  });
});
