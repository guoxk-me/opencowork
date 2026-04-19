import React from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useSchedulerStore } from '../stores/schedulerStore';
import RelationBadge from './RelationBadge';
import ArtifactViewer from './ArtifactViewer';

export function ResultPanel() {
  const { currentResult, currentRunId, currentTemplateId, task, setCurrentResult, openRunsPanel } =
    useTaskStore();
  const { prepareDraftFromTemplate, prepareDraftFromPrompt } = useSchedulerStore();

  if (!currentResult) {
    return null;
  }

  const result = currentResult;

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error('[ResultPanel] Failed to copy value:', error);
    }
  };

  const handleOpenArtifact = async (uri: string) => {
    try {
      await window.electron.invoke('artifact:open', { uri });
    } catch (error) {
      console.error('[ResultPanel] Failed to open artifact:', error);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (currentRunId) {
        await window.electron.invoke('template:createFromRun', { runId: currentRunId });
        return;
      }

      const prompt = task?.description || result.summary;
      await window.electron.invoke('template:create', {
        name: task?.description?.slice(0, 60) || 'Task template',
        description: result.summary,
        prompt,
        executionProfile: 'browser-first',
      });
    } catch (error) {
      console.error('[ResultPanel] Failed to save template:', error);
    }
  };

  const handleAddToScheduler = () => {
    if (currentTemplateId) {
      prepareDraftFromTemplate({
        name: task?.description?.slice(0, 60) || 'Scheduled template task',
        description: result.summary,
        templateId: currentTemplateId,
      });
      return;
    }

    prepareDraftFromPrompt({
      name: task?.description?.slice(0, 60) || 'Scheduled task',
      description: result.summary,
      prompt: task?.description || result.summary,
    });
  };

  return (
    <div className="border-b border-border bg-surface/80 px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-text-muted">Result Delivery</div>
          <div className="mt-1 text-base font-semibold text-white">{result.summary}</div>
        </div>
        <button
          onClick={() => setCurrentResult(null)}
          className="rounded px-2 py-1 text-xs text-text-muted hover:bg-border hover:text-white"
        >
          Hide
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <button onClick={handleSaveTemplate} className="btn btn-secondary text-sm">
          Save as Template
        </button>
        <button onClick={handleAddToScheduler} className="btn btn-secondary text-sm">
          Add to Scheduler
        </button>
        {currentRunId && (
          <button onClick={() => openRunsPanel(currentRunId)} className="btn btn-secondary text-sm">
            View Run
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {currentRunId && (
          <RelationBadge
            label="run"
            value={currentRunId}
            tone="primary"
            onClick={() => openRunsPanel(currentRunId)}
          />
        )}
        {currentTemplateId && <RelationBadge label="template" value={currentTemplateId} />}
        {task?.description && <RelationBadge label="task" value={task.description} tone="muted" />}
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-3">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">Run</div>
          <div className="mt-1 break-all text-white">{currentRunId || result.id}</div>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">Artifacts</div>
          <div className="mt-1 text-white">{result.artifacts.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">Template</div>
          <div className="mt-1 text-white">{currentTemplateId || 'Not linked'}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">Completed</div>
          <div className="mt-1 text-white">{new Date(result.completedAt).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-xs text-text-muted">Reusable</div>
          <div className="mt-1 text-white">{result.reusable ? 'Yes' : 'No'}</div>
        </div>
      </div>

      {result.structuredData !== undefined && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Structured Data</div>
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-xs text-text-secondary">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(result.structuredData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {result.artifacts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-text-muted">Artifacts</div>
          <div className="space-y-2">
            {result.artifacts.map((artifact) => (
              <ArtifactViewer
                key={artifact.id}
                artifact={artifact}
                onOpenArtifact={handleOpenArtifact}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultPanel;
