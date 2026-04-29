import { HybridToolRouter, HybridRouteDecision } from '../../visual';
import {
  ProviderRoutingRequirements,
  getDefaultVisualCapabilityRegistry,
  selectBestVisualProvider,
  VisualProviderDescriptor,
} from '../visual/visualProviderRegistry';
import {
  TaskExecutionTargetKind,
  TaskExecutionTargetSnapshot,
  TaskResult,
  TaskSource,
  TaskVisualProviderSelection,
} from './types';

export type TaskExecutionMode = 'dom' | 'visual' | 'hybrid';

export interface TaskExecutionRoute {
  routeMode: HybridRouteDecision['mode'];
  executionMode: TaskExecutionMode;
  reason: string;
  explicit: boolean;
  source: TaskSource;
  executionTarget: TaskExecutionTargetSnapshot;
  visualProviderRequirements?: ProviderRoutingRequirements | null;
  visualProvider?: TaskVisualProviderSelection | null;
}

export interface ResolveTaskExecutionRouteInput {
  task: string;
  source: TaskSource;
  executionMode?: TaskExecutionMode;
  executionTargetKind?: TaskExecutionTargetKind;
  hasPriorDomFailure?: boolean;
  isVisualTask?: boolean;
  requiresStrictExtraction?: boolean;
  visualProviders?: VisualProviderDescriptor[];
  visualProviderRequirements?: ProviderRoutingRequirements;
}

const hybridToolRouter = new HybridToolRouter();

function deriveExecutionTarget(
  executionMode: TaskExecutionMode,
  executionTargetKind?: TaskExecutionTargetKind
): TaskExecutionTargetSnapshot {
  if (executionTargetKind === 'desktop') {
    return {
      kind: 'desktop',
      environment: 'vm',
    };
  }

  if (executionTargetKind === 'hybrid' || executionMode === 'hybrid') {
    return {
      kind: 'hybrid',
      environment: 'playwright',
    };
  }

  return {
    kind: 'browser',
    environment: 'playwright',
  };
}

function deriveVisualProviderRequirements(
  routeMode: HybridRouteDecision['mode'],
  input: ResolveTaskExecutionRouteInput
): ProviderRoutingRequirements {
  const derived: ProviderRoutingRequirements = {};

  if (routeMode === 'cua') {
    derived.builtInComputerTool = true;
    derived.batchedActions = true;
    derived.nativeScreenshotRequest = true;
  }

  if (routeMode === 'hybrid') {
    derived.structuredOutput = true;
    derived.batchedActions = true;
    derived.toolCalling = true;
    derived.supportsReasoningControl = true;
  }

  if (/screenshot|截图|image|图像/i.test(input.task)) {
    derived.maxImageInputBytes = 1024 * 1024;
  }

  return {
    ...derived,
    ...(input.visualProviderRequirements || {}),
  };
}

function mapRouteModeToExecutionMode(routeMode: HybridRouteDecision['mode']): TaskExecutionMode {
  if (routeMode === 'dom') {
    return 'dom';
  }

  if (routeMode === 'hybrid') {
    return 'hybrid';
  }

  return 'visual';
}

function wrapRawOutput(rawOutput: unknown, routing: TaskExecutionRoute): unknown {
  if (rawOutput && typeof rawOutput === 'object' && !Array.isArray(rawOutput)) {
    return {
      ...(rawOutput as Record<string, unknown>),
      taskRouting: routing,
    };
  }

  return {
    value: rawOutput,
    taskRouting: routing,
  };
}

function resolveVisualProvider(
  providers: VisualProviderDescriptor[] | undefined,
  requirements: ProviderRoutingRequirements | undefined
): TaskExecutionRoute['visualProvider'] {
  const candidates =
    providers && providers.length > 0 ? providers : getDefaultVisualCapabilityRegistry().list();
  const selection = selectBestVisualProvider(candidates, requirements);
  if (!selection.provider) {
    return null;
  }

  return {
    id: selection.provider.id,
    name: selection.provider.name,
    score: selection.score,
    reasons: selection.reasons,
    adapterMode: selection.provider.capabilities.builtInComputerTool ? 'responses-computer' : 'chat-structured',
    capabilities: selection.provider.capabilities,
    signals: selection.provider.signals,
  };
}

export function resolveTaskExecutionRoute(
  input: ResolveTaskExecutionRouteInput
): TaskExecutionRoute {
  const isDesktopTarget = input.executionTargetKind === 'desktop';

  if (input.executionMode) {
    let routeMode: TaskExecutionRoute['routeMode'] =
      input.executionMode === 'dom' ? 'dom' : input.executionMode === 'hybrid' ? 'hybrid' : 'cua';
    let executionMode: TaskExecutionMode = input.executionMode;

    if (isDesktopTarget && input.executionMode === 'dom') {
      routeMode = 'cua';
      executionMode = 'visual';
    }

    const visualProviderRequirements: ProviderRoutingRequirements | null =
      executionMode === 'dom' ? null : deriveVisualProviderRequirements(routeMode, input);

    return {
      routeMode,
      executionMode,
      reason: input.executionTargetKind
        ? `Explicit execution mode provided: ${input.executionMode}; execution target kind: ${input.executionTargetKind}`
        : `Explicit execution mode provided: ${input.executionMode}`,
      explicit: true,
      source: input.source,
      executionTarget: deriveExecutionTarget(executionMode, input.executionTargetKind),
      visualProviderRequirements,
      visualProvider:
        executionMode === 'dom'
          ? null
          : resolveVisualProvider(input.visualProviders, visualProviderRequirements || undefined),
    };
  }

  const decision = hybridToolRouter.decide({
    task: input.task,
    hasPriorDomFailure: input.hasPriorDomFailure,
    isVisualTask: input.isVisualTask,
    requiresStrictExtraction: input.requiresStrictExtraction,
  });
  const visualProviderRequirements: ProviderRoutingRequirements | null =
    (isDesktopTarget && decision.mode === 'dom')
      ? deriveVisualProviderRequirements('cua', input)
      : decision.mode === 'dom'
        ? null
        : deriveVisualProviderRequirements(decision.mode, input);
  const routeMode: TaskExecutionRoute['routeMode'] = isDesktopTarget && decision.mode === 'dom' ? 'cua' : decision.mode;
  const executionMode: TaskExecutionMode = isDesktopTarget && decision.mode === 'dom'
    ? 'visual'
    : mapRouteModeToExecutionMode(decision.mode);

  return {
    routeMode,
    executionMode,
    reason: input.executionTargetKind
      ? `${decision.reason}; execution target kind: ${input.executionTargetKind}`
      : decision.reason,
    explicit: false,
    source: input.source,
    executionTarget: deriveExecutionTarget(executionMode, input.executionTargetKind),
    visualProviderRequirements,
    visualProvider:
      routeMode === 'dom'
        ? null
        : resolveVisualProvider(input.visualProviders, visualProviderRequirements || undefined),
  };
}

export function attachTaskRoutingToResult(result: TaskResult, routing: TaskExecutionRoute): TaskResult {
  return {
    ...result,
    rawOutput: wrapRawOutput(result.rawOutput, routing),
  };
}
