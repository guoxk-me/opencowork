import React from 'react';
import { Task } from '../stores/taskStore';

interface TaskStatusProps {
  task: Task;
}

export function TaskStatus({ task }: TaskStatusProps) {
  const progressPercent = task.progress.total > 0
    ? Math.round((task.progress.current / task.progress.total) * 100)
    : 0;

  return (
    <div className="px-4 py-3 border-b border-border bg-surface">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{task.description}</span>
        <span className="text-sm text-text-muted">
          {task.progress.current} / {task.progress.total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Current step */}
      {task.currentStep && (
        <p className="text-xs text-text-muted mt-2">
          当前: {task.currentStep}
        </p>
      )}
    </div>
  );
}
