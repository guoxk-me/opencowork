import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const openRunsPanel = vi.fn();
const loadAll = vi.fn();
const save = vi.fn();
const testConnection = vi.fn();
const setActiveTab = vi.fn();
const setPanelOpen = vi.fn();
const setMessage = vi.fn();

const imStoreState = {
  configs: {
    feishu: { enabled: true, appId: 'app-id', appSecret: 'app-secret' },
    dingtalk: { enabled: false, appKey: '', appSecret: '' },
    wecom: { enabled: false, corpId: '', agentId: '', corpSecret: '' },
    slack: { enabled: false, botToken: '', signingSecret: '' },
  },
  statuses: {
    feishu: 'connected',
    dingtalk: 'disconnected',
    wecom: 'disconnected',
    slack: 'disconnected',
  },
  activeTab: 'feishu' as const,
  isPanelOpen: true,
  isLoading: false,
  isSaving: false,
  message: null,
  setActiveTab,
  setPanelOpen,
  loadAll,
  save,
  test: testConnection,
  setMessage,
};

vi.mock('../../stores/imStore', () => ({
  useIMStore: () => imStoreState,
}));

vi.mock('../../stores/taskStore', () => ({
  useTaskStore: () => ({
    openRunsPanel,
  }),
}));

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'imConfig.status.connected') {
        return `${params?.platform || ''} connected`;
      }
      return key;
    },
  }),
}));

import { IMConfigPanel } from '../IMConfigPanel';

describe('IMConfigPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'setInterval').mockReturnValue({} as ReturnType<typeof setInterval>);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        invoke: vi.fn().mockImplementation((channel: string) => {
          if (channel === 'im:recentTasks') {
            return Promise.resolve([
              {
                id: 'im-task-1',
                status: 'completed',
                resultSummary: 'Found 3 vendors',
                runId: 'run-123',
                artifactsCount: 2,
                updatedAt: 1710000000000,
              },
            ]);
          }
          return Promise.resolve({});
        }),
      },
    });
  });

  it('opens the runs panel from a recent IM task card', async () => {
    render(<IMConfigPanel />);

    expect(loadAll).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Found 3 vendors')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'View Run' }));

    expect(openRunsPanel).toHaveBeenCalledWith('run-123');
  });
});
