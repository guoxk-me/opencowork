# PRD 6.0 / SPEC P4 Delivery Checklist

This document tracks the remaining work needed to fully close out the PRD 6.0 line and the P4 desktop computer-use spec.

Status legend:

- `done`: implemented and verified in code/tests
- `partial`: real progress exists, but the spec is not yet fully satisfied
- `todo`: not meaningfully implemented yet

## PRD 6.0 Checklist

| Area | Status | Current state | Next step |
| --- | --- | --- | --- |
| Unified task model | done | `TaskRun`, `TaskResult`, `TaskTemplate`, history/result delivery are wired through the product surfaces | Keep stable, only revise if new fields are required |
| Result-first UX | done | Result sidebar, history surfaces, and task result rendering are in place | Polish edge cases and consistency |
| Template reuse | done | Successful runs can become templates and rerun with parameters | Expand template UX only if new flows are needed |
| Multi-entry execution | done | Chat, scheduler, IM, replay share the task pipeline | Continue regression coverage |
| Scheduler integration | done | Task execution and persisted results are integrated with scheduler flows | No major blocker |
| IM integration | done | IM entry points, result delivery, and attachments are integrated | Continue consistency fixes |
| MCP support | done | MCP client/server support is present in the codebase | Keep feature parity with the task pipeline |
| Browser-first runtime | done | Visual runtime and browser execution path are stable | Maintain test coverage |
| Desktop computer use | partial | Desktop abstraction, providers, lifecycle-managed controller shells, desktop action contract, execution target surfacing, workflow semantics, VM-focused smoke benchmarks, mixed workflow routing, benchmark trend reporting, and desktop restart/file-dialog/window-focus recovery exist | Finish real desktop harness behavior and desktop-grade recovery |
| Skills ecosystem | partial | Skill loading, install/uninstall, contract preview, source/capability filtering, and refresh feedback are now productized | Finish catalog/update polish and release-grade discovery flows |
| Workflow packs | done | Packs exist, and the catalog now surfaces outcomes, install feedback, installed-state sorting, and installed-only filtering | Keep pack content expanding, but the product surface is ready |
| Security / permission UX | partial | Approval flow exists, and desktop-specific risk reasons, execution target context, and intent keywords are now surfaced in the approval dialog and runtime audit snapshot | Finish release-grade approval policy tuning and copy polish |
| Documentation / release readiness | partial | Docs are being updated alongside implementation | Close spec gaps, add release notes, and mark final states |

## SPEC P4 Checklist

| Area | Status | Current state | Next step |
| --- | --- | --- | --- |
| Unified execution abstraction | done | `ComputerExecutionAdapter` and `ComputerExecutionTarget` are in place | Keep stable |
| Browser / desktop / hybrid target routing | done | Task routing now carries `executionTarget` through the product pipeline | Continue edge-case regression tests |
| Desktop execution providers | done | `vm`, `container`, `native-bridge`, and browser-backed providers are wired | Add stronger runtime behavior to the real backends |
| VM harness controller | partial | Lifecycle state, env-driven hooks, serialized transitions, restart recovery, tests, runtime smoke coverage, and runtime contract are in place | Turn the skeleton into a real stable harness |
| Container harness controller | partial | Lifecycle state, serialized transitions, hook observability, restart recovery, sandbox context metadata, tests, and runtime contract are in place | Add genuine container-driven behavior and lifecycle guarantees |
| Native bridge provider | partial | Provider now has lifecycle state, serialized transitions, tests, and action contract metadata, but still lacks a real native bridge backend | Implement a real native bridge or explicitly narrow scope |
| Desktop action protocol | partial | Workflow-level desktop capability metadata and action semantics are now exposed on the runtime contract and result views | Add native desktop execution for open/focus/save/upload/download flows |
| Approval and safety | partial | Desktop approval-aware flows and audits exist in the browser/visual pipeline | Expand desktop-specific risk taxonomy and UI surfacing |
| Recovery and verification | partial | Focus, file-dialog, upload, desktop refocus, and desktop restart recovery benchmarks exist | Build a broader desktop recovery engine and more failure modes |
| Capability registry extension | partial | Provider selection exists and desktop capability metadata is exposed | Expand capability data for desktop-specific constraints |
| Benchmark and evaluation | partial | Smoke suite and mixed desktop benchmark coverage now include VM-specific notes smoke, file and transfer flows, trend reporting, repeated-run stability checks, consecutive-success gating, and a release gate summary | Add broader desktop recovery coverage and tighten the regression gate |
| User-visible execution target surfacing | done | Target metadata, desktop action contract, and history normalization are visible in result, history, and task run panels | Keep UI copy and fallbacks consistent |
| Desktop release hardening | partial | The desktop path is materially closer to a productized backend, with recovery, benchmark, and approval surfaces hardened, but release criteria still need a final pass | Finish harness stability, polish, and release criteria |

## Recommended Finish Order

1. Turn the VM harness into the primary stable desktop backend.
2. Decide whether container or native-bridge should become real backends or remain fallback shells.
3. Complete the desktop action contract for file and window workflows.
4. Expand desktop approval and recovery until the new benchmarks pass consistently.
5. Add benchmark trend reporting and repeatability checks.
6. Close any remaining UI and documentation gaps, then mark P4 and the PRD line complete.

## Current Blocking Gaps

- Desktop harnesses are still partly skeletonized.
- Desktop-level workflows beyond core UI actions are not fully formalized.
- Recovery coverage exists, but more failure modes need real handling.
- Benchmarking exists, but not yet at the level needed to declare full desktop productization complete.
