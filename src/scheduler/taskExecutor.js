// src/scheduler/taskExecutor.ts
import { ExecutorMode } from './types';
import { HistoryService } from '../history/historyService';
export class TaskExecutor {
    historyService;
    config;
    constructor(config = { mode: ExecutorMode.STANDALONE }) {
        this.historyService = new HistoryService();
        this.config = config;
    }
    async execute(task) {
        const scheduledTask = task.scheduledTask;
        const startTime = Date.now();
        console.log('[TaskExecutor] Starting scheduled task:', scheduledTask.name);
        let historyRecordId = null;
        try {
            const historyRecord = await this.historyService.createTask(`[定时] ${scheduledTask.name}: ${scheduledTask.execution.taskDescription}`, {
                source: 'scheduler',
                scheduledTaskId: scheduledTask.id,
                scheduledTaskName: scheduledTask.name,
            });
            historyRecordId = historyRecord.id;
            await this.historyService.startTaskById(historyRecord.id);
            if (this.config.mode === ExecutorMode.INTEGRATED) {
                await this.executeWithMainAgent(scheduledTask.execution.taskDescription, scheduledTask.execution.timeout);
            }
            else {
                await this.executeStandalone(scheduledTask.execution.taskDescription, scheduledTask.execution.timeout);
            }
            await this.historyService.completeTask(historyRecord.id, {
                success: true,
                output: 'Task completed successfully',
            });
            return {
                taskId: scheduledTask.id,
                status: 'success',
                startTime,
                endTime: Date.now(),
                duration: Date.now() - startTime,
                retryCount: task.retryCount,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[TaskExecutor] Task failed:', scheduledTask.name, errorMessage);
            if (historyRecordId) {
                try {
                    await this.historyService.completeTask(historyRecordId, {
                        success: false,
                        error: errorMessage,
                    });
                }
                catch (e) {
                    console.error('[TaskExecutor] Failed to update history:', e);
                }
            }
            return {
                taskId: scheduledTask.id,
                status: 'failed',
                startTime,
                endTime: Date.now(),
                duration: Date.now() - startTime,
                error: errorMessage,
                retryCount: task.retryCount,
            };
        }
    }
    async executeWithMainAgent(description, timeout) {
        console.log('[TaskExecutor] Execute with MainAgent:', description);
        await this.simulateExecution(timeout);
    }
    async executeStandalone(description, timeout) {
        console.log('[TaskExecutor] Execute standalone:', description);
        await this.simulateExecution(timeout);
    }
    async simulateExecution(timeout) {
        const waitTime = timeout || 1000;
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 60000)));
    }
}
