import React from 'react';
import { useTaskStore } from '../stores/taskStore';

export function ControlBar() {
  const { task, setTakeover, showPlanViewer, setShowPlanViewer, previewMode, setPreviewMode } = useTaskStore();

  const handleTakeover = () => {
    setTakeover(true);
  };

  const handlePause = () => {
    console.log('Pause task');
  };

  const handleStop = () => {
    console.log('Stop task');
  };

  return (
    <div className="h-14 flex items-center justify-between px-4 border-t border-border bg-surface">
      {/* Left: Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleTakeover}
          className="btn btn-secondary"
          disabled={!task || task.status === 'idle'}
        >
          接管
        </button>
        <button
          onClick={handlePause}
          className="btn btn-secondary"
          disabled={!task || task.status !== 'executing'}
        >
          暂停
        </button>
        <button
          onClick={handleStop}
          className="btn btn-danger"
          disabled={!task || task.status === 'idle' || task.status === 'completed'}
        >
          停止
        </button>
      </div>

      {/* Center: Status */}
      <div className="text-sm text-text-secondary">
        {task ? (
          <span>
            {task.status === 'idle' && '等待任务'}
            {task.status === 'planning' && '规划中...'}
            {task.status === 'executing' && task.currentStep ? `执行中: ${task.currentStep}` : '执行中'}
            {task.status === 'paused' && '已暂停'}
            {task.status === 'waiting_confirm' && '等待确认'}
            {task.status === 'completed' && '已完成'}
            {task.status === 'failed' && `失败: ${task.error || '未知错误'}`}
          </span>
        ) : (
          '无活动任务'
        )}
      </div>

      {/* Right: View options */}
      <div className="flex items-center gap-2">
        {/* Preview Mode Switcher - Icon buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewMode('sidebar')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              previewMode === 'sidebar' 
                ? 'bg-primary text-white' 
                : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'
            }`}
            title="侧边预览"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          <button
            onClick={() => setPreviewMode('detached')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              previewMode === 'detached' 
                ? 'bg-primary text-white' 
                : 'bg-elevated text-text-secondary hover:text-white hover:bg-border'
            }`}
            title="独立窗口"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => setShowPlanViewer(!showPlanViewer)}
          className={`btn ${showPlanViewer ? 'btn-primary' : 'btn-secondary'}`}
        >
          计划
        </button>
      </div>
    </div>
  );
}
