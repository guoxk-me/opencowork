import { TaskPlanner } from '../planner/TaskPlanner';
import { PlanExecutor } from '../planner/PlanExecutor';
import { TakeoverManager } from './TakeoverManager';
import { Replanner, ReplanTrigger } from '../planner/Replanner';
import { generateId } from '../action/ActionSchema';
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["IDLE"] = "idle";
    TaskStatus["PLANNING"] = "planning";
    TaskStatus["EXECUTING"] = "executing";
    TaskStatus["PAUSED"] = "paused";
    TaskStatus["WAITING_CONFIRM"] = "waiting_confirm";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (TaskStatus = {}));
export class TaskEngine {
    planner;
    executor;
    replanner;
    _takeoverManager;
    tasks = new Map();
    mainWindow = null;
    previewWindow = null;
    currentTaskId = null;
    constructor() {
        this.planner = new TaskPlanner();
        this.executor = new PlanExecutor();
        this.replanner = new Replanner();
        this._takeoverManager = new TakeoverManager();
    }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    setPreviewWindow(window) {
        this.previewWindow = window;
    }
    isTaskRunning() {
        return this.currentTaskId !== null;
    }
    async startTask(task, mainWindow) {
        if (mainWindow) {
            this.mainWindow = mainWindow;
        }
        // 检查是否有任务正在执行
        if (this.currentTaskId && this.tasks.has(this.currentTaskId)) {
            const currentHandle = this.tasks.get(this.currentTaskId);
            if (currentHandle && (currentHandle.status === TaskStatus.EXECUTING || currentHandle.status === TaskStatus.PLANNING)) {
                throw new Error('已有任务正在执行中，请等待完成后再发起新任务');
            }
        }
        const handle = {
            id: generateId(),
            status: TaskStatus.PLANNING,
            progress: { current: 0, total: 0 },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.currentTaskId = handle.id;
        this.tasks.set(handle.id, handle);
        try {
            console.log(`[TaskEngine] Starting task ${handle.id}:`, task);
            // 获取当前上下文
            let currentUrl = '';
            let currentPageContent = '';
            let pageStructure = null;
            try {
                currentUrl = await this.executor.getPageUrl();
                currentPageContent = await this.executor.getPageContent();
                pageStructure = await this.executor.getPageStructure();
                console.log('[TaskEngine] pageStructure retrieved:', {
                    hasTitle: !!pageStructure?.title,
                    linksCount: pageStructure?.links?.length || 0,
                    containersCount: pageStructure?.containers?.length || 0,
                    mainContentArea: pageStructure?.mainContentArea,
                });
            }
            catch (e) {
                console.log('[TaskEngine] Could not get current page info:', e);
            }
            const plan = await this.planner.plan(task, {
                currentUrl,
                currentPageContent,
                pageStructure,
            });
            handle.plan = plan;
            handle.status = TaskStatus.EXECUTING;
            handle.progress = {
                current: 0,
                total: plan.nodes.filter((n) => n.type === 'action').length,
            };
            // 任务开始，恢复预览传输
            this.executor.setTaskRunning(true);
            // 正确 await 任务执行完成
            await this.executePlan(handle.id);
            return handle;
        }
        catch (error) {
            console.error(`[TaskEngine] Failed to start task:`, error);
            handle.status = TaskStatus.FAILED;
            this.sendToRenderer('task:error', { handleId: handle.id, error: error.message });
            throw error;
        }
        finally {
            // 任务完成后清空当前任务ID
            if (this.currentTaskId === handle.id) {
                this.currentTaskId = null;
            }
            // 任务完成后继续传输预览，但降低 fps
            this.executor.setTaskRunning(false);
        }
    }
    async executePlan(handleId) {
        const handle = this.tasks.get(handleId);
        if (!handle || !handle.plan)
            return;
        // 启动实时截图
        this.executor.startScreencast();
        try {
            for await (const event of this.executor.execute(handle.plan)) {
                switch (event.type) {
                    case 'node_start':
                        handle.progress.current++;
                        // 如果是 ask:user action，设置状态为 waiting_confirm
                        if (event.node.action?.type === 'ask:user') {
                            handle.status = TaskStatus.WAITING_CONFIRM;
                        }
                        this.sendToRenderer('task:nodeStart', event);
                        break;
                    case 'node_complete':
                        // 如果之前是 ask:user，恢复执行状态
                        if (handle.status === TaskStatus.WAITING_CONFIRM) {
                            handle.status = TaskStatus.EXECUTING;
                        }
                        this.sendToRenderer('task:nodeComplete', event);
                        break;
                    case 'node_error':
                        console.error(`[TaskEngine] Node error:`, event.error);
                        // 检测是否有弹窗导致操作失败
                        const popupStatusDuringError = await this.executor.checkLoginPopup();
                        if (popupStatusDuringError.hasPopup) {
                            console.log('[TaskEngine] Login popup detected during execution, pausing for user');
                            this.sendToRenderer('task:waiting_login', {
                                message: '检测到登录弹窗，请关闭后继续'
                            });
                            this.executor.pause();
                            await this.waitForPopupClosed();
                            this.executor.resume();
                            // 弹窗关闭后，继续处理错误
                        }
                        // 尝试使用 LLM 驱动的 Replanner 恢复
                        const errorCode = event.error?.code || 'UNKNOWN';
                        const isRecoverable = event.error?.recoverable ?? true;
                        if (isRecoverable && handle.plan) {
                            const executionState = {
                                currentNodeId: event.node?.id || '',
                                completedNodes: [],
                                pageUrl: event.node?.action?.type === 'browser:navigate' ? event.node.action.params?.url : undefined,
                            };
                            let retryCount = 0;
                            let replanSuccess = false;
                            let failedNodeId = event.node?.id;
                            while (retryCount < 3 && !replanSuccess) {
                                // 获取当前页面内容
                                const pageContent = await this.executor.getPageContent();
                                const replanRequest = {
                                    trigger: errorCode === 'SELECTOR_NOT_FOUND' ? ReplanTrigger.SELECTOR_INVALID :
                                        errorCode === 'NAVIGATION_ERROR' ? ReplanTrigger.NAVIGATION_ERROR :
                                            errorCode === 'WAIT_TIMEOUT' ? ReplanTrigger.TIMEOUT :
                                                ReplanTrigger.ACTION_FAILED,
                                    failedNodeId: event.node?.id,
                                    error: {
                                        code: errorCode,
                                        message: event.error?.message || 'Unknown error',
                                        recoverable: isRecoverable,
                                    },
                                    executionState,
                                    remainingPlan: handle.plan,
                                    pageContent,
                                };
                                // 使用 LLM 决策的重试机制
                                const replanResult = await this.replanner.decideWithRetry(replanRequest, retryCount);
                                console.log(`[TaskEngine] Replan attempt ${retryCount + 1}:`, replanResult);
                                if (replanResult.success && replanResult.canContinue) {
                                    replanSuccess = true;
                                    this.sendToRenderer('task:statusUpdate', {
                                        status: 'replanning',
                                        message: `正在重试 (${retryCount + 1}/3): ${replanResult.reason || '重新执行'}`
                                    });
                                    // 应用 modifiedNodes 到计划
                                    if (replanResult.modifiedNodes) {
                                        for (const mod of replanResult.modifiedNodes) {
                                            const nodeIndex = handle.plan.nodes.findIndex(n => n.id === mod.nodeId);
                                            if (nodeIndex !== -1) {
                                                if (mod.retryCount === -1) {
                                                    // 跳过节点
                                                    handle.plan.nodes.splice(nodeIndex, 1);
                                                }
                                                else if (mod.newSelector && handle.plan.nodes[nodeIndex].action) {
                                                    // 处理逗号分隔的选择器
                                                    let mainSelector = mod.newSelector;
                                                    let fallback = [];
                                                    if (mod.newSelector.includes(',')) {
                                                        const parts = mod.newSelector.split(',').map(s => s.trim());
                                                        mainSelector = parts[0];
                                                        fallback = parts.slice(1);
                                                    }
                                                    // 如果有额外的 fallbackSelectors，合并
                                                    if (mod.fallbackSelectors && mod.fallbackSelectors.length > 0) {
                                                        fallback = [...fallback, ...mod.fallbackSelectors];
                                                    }
                                                    handle.plan.nodes[nodeIndex].action.params.selector = mainSelector;
                                                    if (fallback.length > 0) {
                                                        handle.plan.nodes[nodeIndex].action.params.fallbackSelectors = fallback;
                                                    }
                                                }
                                                else if (mod.newAction && handle.plan.nodes[nodeIndex].action) {
                                                    handle.plan.nodes[nodeIndex].action = mod.newAction;
                                                }
                                            }
                                        }
                                    }
                                    // 重规划成功后，重新执行当前失败的节点
                                    if (failedNodeId) {
                                        const retryNodeIndex = handle.plan.nodes.findIndex(n => n.id === failedNodeId);
                                        if (retryNodeIndex !== -1) {
                                            const retryNode = handle.plan.nodes[retryNodeIndex];
                                            if (!retryNode.action) {
                                                console.warn(`[TaskEngine] Retry node has no action, skipping`);
                                                continue;
                                            }
                                            console.log(`[TaskEngine] Retrying failed node: ${failedNodeId}`);
                                            try {
                                                const retryResult = await this.executor.executeSingleAction(retryNode.action);
                                                if (retryResult.success) {
                                                    console.log(`[TaskEngine] Retry succeeded for node: ${failedNodeId}`);
                                                    this.sendToRenderer('task:nodeComplete', { node: retryNode, result: retryResult });
                                                }
                                                else {
                                                    console.log(`[TaskEngine] Retry failed for node: ${failedNodeId}, retry count: ${retryCount + 1}`);
                                                    retryCount++;
                                                    replanSuccess = false;
                                                    if (retryCount >= 3) {
                                                        break;
                                                    }
                                                    continue;
                                                }
                                            }
                                            catch (retryError) {
                                                console.error(`[TaskEngine] Retry error:`, retryError);
                                                retryCount++;
                                                if (retryCount >= 3) {
                                                    replanSuccess = false;
                                                    break;
                                                }
                                                continue;
                                            }
                                        }
                                    }
                                    break;
                                }
                                else {
                                    retryCount++;
                                    if (retryCount >= 3) {
                                        break;
                                    }
                                }
                            }
                            if (replanSuccess) {
                                continue;
                            }
                        }
                        this.sendToRenderer('task:error', event);
                        break;
                    case 'completed':
                        handle.status = TaskStatus.COMPLETED;
                        console.log(`[TaskEngine] Task completed, sending event to renderer`);
                        this.sendToRenderer('task:completed', { handleId, result: event.summary });
                        break;
                    case 'failed':
                        handle.status = TaskStatus.FAILED;
                        console.log(`[TaskEngine] Task failed, sending event to renderer`);
                        this.sendToRenderer('task:error', { handleId, error: event.error });
                        break;
                }
                handle.updatedAt = Date.now();
            }
        }
        catch (error) {
            console.error(`[TaskEngine] Plan execution failed:`, error);
            handle.status = TaskStatus.FAILED;
            this.sendToRenderer('task:error', { handleId, error: error.message || 'Unknown error' });
        }
        finally {
            // 不再停止预览传输，而是保持低 fps 继续传输
            // 预览传输由 setTaskRunning(false) 在外层 finally 中处理
        }
    }
    async pause(handleId) {
        const handle = this.tasks.get(handleId);
        if (handle) {
            this.executor.pause();
            handle.status = TaskStatus.PAUSED;
            console.log(`[TaskEngine] Task paused: ${handleId}`);
        }
    }
    async resume(handleId) {
        const handle = this.tasks.get(handleId);
        if (handle) {
            this.executor.resume();
            handle.status = TaskStatus.EXECUTING;
            console.log(`[TaskEngine] Task resumed: ${handleId}`);
        }
    }
    async takeover(handleId) {
        const handle = this.tasks.get(handleId);
        if (!handle)
            return null;
        await this.pause(handleId);
        return {
            currentNode: null,
            completedActions: [],
            pendingNodes: [],
            aiContext: {
                currentTask: '',
                conversationHistory: [],
                variables: {},
            },
        };
    }
    async resumeFromUser(handleId, action) {
        console.log(`[TaskEngine] Resuming from user action:`, action);
        await this.resume(handleId);
    }
    async cancel(handleId) {
        const handle = this.tasks.get(handleId);
        if (handle) {
            this.executor.pause();
            handle.status = TaskStatus.CANCELLED;
            console.log(`[TaskEngine] Task cancelled: ${handleId}`);
        }
    }
    async waitForPopupClosed() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
                const status = await this.executor.checkLoginPopup();
                if (!status.hasPopup) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 2000);
            setTimeout(() => {
                clearInterval(checkInterval);
                console.log('[TaskEngine] Popup wait timeout, continuing anyway');
                resolve();
            }, 60000);
        });
    }
    getState(handleId) {
        return this.tasks.get(handleId) || null;
    }
    sendToRenderer(channel, data) {
        console.log('[TaskEngine] sendToRenderer called:', {
            channel,
            mainWindowExists: !!this.mainWindow,
            mainWindowDestroyed: this.mainWindow?.isDestroyed(),
            previewWindowExists: !!this.previewWindow,
            data: JSON.stringify(data).substring(0, 100)
        });
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
            console.log('[TaskEngine] Sent to mainWindow:', channel);
        }
        else {
            console.warn('[TaskEngine] mainWindow not available or destroyed!');
        }
        if (this.previewWindow && !this.previewWindow.isDestroyed()) {
            this.previewWindow.webContents.send(channel, data);
            console.log('[TaskEngine] Sent to previewWindow:', channel);
        }
    }
}
export default TaskEngine;
