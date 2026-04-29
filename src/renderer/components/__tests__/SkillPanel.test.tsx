import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

describe('SkillPanel', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockImplementation((channel: string) => {
      if (channel === 'skill:list') {
        return Promise.resolve({
          success: true,
          data: [
            {
              name: 'meeting-note',
              version: '0.2.0',
              description: 'Capture and summarize meeting notes',
              path: '/skills/meeting-note',
              installed: true,
              source: 'agent-created',
              userInvocable: false,
              useCases: ['Meeting summary'],
              inputSpec: 'Meeting transcript or notes',
              outputSpec: 'Action items and summary',
              failureHints: ['Verify transcript completeness'],
              tags: ['notes'],
            },
            {
              name: 'daily-report',
              version: '1.0.0',
              description: 'Generate a daily report',
              path: '/skills/daily-report',
              installed: true,
              source: 'official',
              updateAvailable: true,
              userInvocable: true,
              useCases: ['Daily reporting', 'Team summary'],
              inputSpec: 'Date range and data sources',
              outputSpec: 'Markdown report and summary card',
              failureHints: ['Check Slack connection', 'Verify email access'],
              allowedTools: ['connector:slack', 'connector:email'],
              tags: ['report', 'team'],
            },
          ],
        });
      }

      return Promise.resolve({ success: true, data: [] });
    });
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        invoke,
      },
    });
  });

  it('renders productized skill contract fields', async () => {
    const { SkillPanel } = await import('../SkillPanel');

    render(<SkillPanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('daily-report')).toBeInTheDocument();
    });

    expect(screen.getAllByText('用途').length).toBeGreaterThan(0);
    expect(screen.getByText('Daily reporting')).toBeInTheDocument();
    expect(screen.getAllByText('输入').length).toBeGreaterThan(0);
    expect(screen.getByText('Date range and data sources')).toBeInTheDocument();
    expect(screen.getAllByText('输出').length).toBeGreaterThan(0);
    expect(screen.getByText('Markdown report and summary card')).toBeInTheDocument();
    expect(screen.getAllByText('失败提示').length).toBeGreaterThan(0);
    expect(screen.getByText('Check Slack connection')).toBeInTheDocument();
    expect(screen.getAllByText('允许工具').length).toBeGreaterThan(0);
    expect(screen.getByText('connector:slack')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '来源: official')
    ).toBeInTheDocument();
    expect(screen.getByText('可用户调用')).toBeInTheDocument();
  });

  it('refreshes skill list when a skill changes', async () => {
    const { SkillPanel } = await import('../SkillPanel');

    render(<SkillPanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('skill:list');
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('skill:changed', { detail: { name: 'saved-skill' } }));
    });

    await waitFor(() => {
      expect(invoke.mock.calls.filter(([channel]) => channel === 'skill:list').length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText('Skill library refreshed')).toBeInTheDocument();
  });

  it('filters skills by source and keyword', async () => {
    const { SkillPanel } = await import('../SkillPanel');

    render(<SkillPanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('daily-report')).toBeInTheDocument();
    });

    expect(screen.getByText('meeting-note')).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'official' },
    });

    expect(screen.getByText('daily-report')).toBeInTheDocument();
    expect(screen.queryByText('meeting-note')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search skills|skillPanel\.searchSkills/i), {
      target: { value: 'daily' },
    });

    expect(screen.getByText('daily-report')).toBeInTheDocument();
    expect(screen.queryByText('meeting-note')).not.toBeInTheDocument();
  });

  it('filters skills with available updates and sorts them first', async () => {
    const { SkillPanel } = await import('../SkillPanel');

    render(<SkillPanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('daily-report')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Update available').length).toBeGreaterThan(0);

    const cards = screen.getAllByText(/daily-report|meeting-note/);
    expect(cards[0]).toHaveTextContent('daily-report');

    fireEvent.change(screen.getByRole('combobox', { name: 'Update filter' }), {
      target: { value: 'update-available' },
    });

    expect(screen.getByText('daily-report')).toBeInTheDocument();
    expect(screen.queryByText('meeting-note')).not.toBeInTheDocument();
  });

  it('refreshes an installed skill from its card action', async () => {
    const { SkillPanel } = await import('../SkillPanel');

    render(<SkillPanel isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('daily-report')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update skill' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('skill:update', { name: 'daily-report' });
    });

    expect(screen.getByText('Skill refreshed')).toBeInTheDocument();
  });
});
