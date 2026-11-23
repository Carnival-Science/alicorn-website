---
title: Research
description: Decision and evidence records behind Alicorn's layout, rendering, motion, invalidation, and component boundaries.
---

Alicorn is a research project, so the reasoning behind a boundary matters as much as the API that
implements it. Each record states a question, the evidence that was collected, the disposition, and
the limits of that evidence. Records live beside the code in
[`docs/research/`](https://github.com/Carnival-Science/Alicorn/tree/master/docs/research) and are
linked from the pull request that changed behavior.

The full validation evidence — platform matrices, raw runs, screenshots, and acceptance reports —
lives in [`docs/validation/`](https://github.com/Carnival-Science/Alicorn/tree/master/docs/validation).
A headless test establishes the behavior that test covers; it does not establish native window
presentation, OS accessibility behavior, or GPU output.

## Records

| Record | Question | Disposition |
| --- | --- | --- |
| [AliKit proposal](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/alicorn-kit.md) | Where do reusable components belong? | AliKit is an optional, source-level companion; see the [component authoring standard](/docs/guides/component-authoring/). |
| [Layout scopes and fit-content panels](/docs/research/layout-scopes/) | Why does a padded fit-content panel measure padding only? | Scope helpers close at the end of their invocation block; this is an authoring error, not a measurement defect. |
| [Description locality](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/description-locality-re-describable-subtrees.md) | Which subtrees can be re-described without disturbing siblings? | Measured A/B; keyed regions are the supported path. |
| [Styling foundation](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-244-246-styling-foundation.md) | Can ordinary Odin style values change a component's anatomy while it keeps ownership of input, layout, keys, and semantics? | Initial research with AliKit Radio Group and Segmented Control consumers; the vocabulary stays pilot-local. |
| [Construction history](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-157-construction-history.md) | How did retained-tree construction reach its current shape? | Read-only history review of the hot path. |
| [Hot-path audit](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-157-current-hot-path-audit-2026-11-04.md) | What dominates construction cost? | Audit of recorded benchmark and profiler artifacts. |
| [Host-owned presentation](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-162-host-owned-presentation.md) | Can the host own presentation without breaking retention? | Bounded SDL_GPU proof on Windows. |
| [Embedded GPU canvas](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-164-gpu-canvas.md) | Is a public raw-GPU callback needed? | No new public core API; retained geometry surfaces express the workload. |
| [Native mesh locality](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-169-native-mesh-locality.md) | Where should mesh work live? | Measured locality result in the retained renderer. |
| [Host loop integration](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-196-host-loop-integration.md) | How does Alicorn join a desktop host loop? | Source-level integration boundary. |
| [Dense retained markers](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-201-dense-retained-markers.md) | Do dense point markers fit the geometry budget? | Readback and cost validation passed on Metal and D3D12. |
| [Retained node size](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-203-retained-node-size.md) | Is the retained node budget sufficient? | Resolved by the node-size reduction; no budget increase. |
| [Multisurface presentation](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-205-multisurface-presentation.md) | Can one runtime present to several native targets? | Shared presentation outputs with per-target acknowledgement. |
| [Surface-local text](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-207-surface-local-text.md) | Can positioned text live on a geometry surface? | Surface-local positioned text with authored layout. |
| [Shape primitives](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-110-shape-primitives.md) | What shape vocabulary is safe and testable? | Bounded Circle/Arc/Cubic-Bezier prototype; accepted on Windows D3D12. |
| [Two-stop gradients](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-119-two-stop-gradients.md) | Can surface gradients stay bounded? | Bounded two-stop prototype with native acceptance on Windows. |
| [Retained effects](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/retained-effects-issue-111.md) | Which effects belong in the core? | Bounded alpha-mask shadow first; backdrop blur is a separate input-capture problem. |
| [Visual state transitions](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/visual-state-transitions.md) | Can visual state animate without moving layout? | Timed presentation transitions with stable target geometry. |
| [Motion ownership](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-138-motion-ownership.md) | Who owns a motion value? | Typed property targeting on the retained runtime. |
| [Residual motion](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-137-analytic-residual-motion.md) | How does motion settle after interruption? | Analytic residual motion with explicit cadence. |
| [Sizing decision](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-109-completion-plan.md) | Did the sizing algebra succeed? | Partial adoption; definite-parent percentage width kept. |
| [Scene lighting](https://github.com/Carnival-Science/Alicorn/blob/master/docs/research/issue-105-lighting.md) | Can lighting sit above paint? | Experimental prototype; bounded to a scene-local surface. |

## Reading a record

- **Status** says whether the record is a proposal, an experimental prototype, or an accepted
  decision.
- **Evidence** names the platform, revision, and test or capture that supports the claim.
- **Limits** state what was not measured. A missing platform run is a gap, not a pass.

When a record and a page disagree, the record and the current source win; the page is the summary.
