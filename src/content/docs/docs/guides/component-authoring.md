---
title: Component authoring standard
description: The five-point contract a reusable Alicorn component must demonstrate, and the page template that makes each point inspectable.
---

Alicorn ships layout, styling, motion, interaction, accessibility, rendering, and testing
primitives. It does not ship a component framework. A component is a package of ordinary Odin
values and procedures over the public `alicorn:ui` and `alicorn:runtime` interfaces, with tests
that drive the same input paths a host uses.

The full standard is in the repository at
[`docs/component-authoring.md`](https://github.com/Carnival-Science/Alicorn/blob/master/docs/component-authoring.md).
This page is the working summary: the responsibility split, the five points, the extraction rule,
and the page template used by the [AliKit catalog](/components/).

## Division of responsibility

| Layer | Owns | Does not own |
| --- | --- | --- |
| **Alicorn** (`alicorn:ui`, `alicorn:runtime`, `alicorn:testui`) | Layout, styling, motion, interaction, accessibility semantics, rendering, and testing primitives. Public controls such as Button, Select, virtual lists, tabs, overlays, and semantic collections. | A ready-made component catalog, application policy, or a second component lifecycle. |
| **AliKit** (optional, external) | Composable component parts and reference implementations that combine Alicorn primitives for a recurring job. | A second runtime, theme engine, retained tree, state store, or required framework. |
| **Application** | Custom behaviors as ordinary Odin procedures, composition, domain state, visual identity, and product policy. | Private runtime storage, a parallel accessibility tree, or a new engine subsystem. |

```text
Application
├── AliKit (optional)
│   └── Alicorn
└── Alicorn
```

Alicorn never imports AliKit or an application. AliKit imports the public Alicorn packages, never
private runtime fields. An application may skip AliKit entirely and copy a component into its own
tree; the copy remains an ordinary public-API consumer.

State follows the same split. The application owns domain values and stable identities. A
component receives a caller-owned state pointer for ephemeral interaction such as an open flag, an
active row, or a query buffer. Alicorn retains no pointer into application values.

If a component needs private runtime storage or a new host hook, stop and make that a focused
Alicorn API proposal. Do not add a component-local workaround that reads private state, and do not
grow AliKit into a second runtime.

## The five-point standard

A component is ready to publish when all five points hold, and its documentation makes each one
inspectable.

1. **A complete, copyable implementation.** Ship the full working package, its theme data, a
   runnable call site, and its tests. A reader must be able to copy the folder into another project
   and build it without missing glue. AliKit's `icon_picker` proves this by building a copied
   source tree outside AliKit's collection topology.
2. **Individually composable parts.** Expose the trigger, list or grid, rows, actions, and overlays
   as separate public types and procedures with stable keys and semantic identities. The caller
   must be able to omit a part, replace a row rendering, or compose the parts into a different
   shell.
3. **Custom styling and motion.** Provide a component-owned recipe and style with namespaced theme
   extension roles, validate required roles at setup, and allow per-instance overrides without
   forking the component. Selection must remain apparent without relying on color alone. Motion
   uses `ui.motion`, retargets from the current presentation, honors reduced motion, and settles to
   idle.
4. **Keyboard and accessibility contracts.** State the key map, the focus owner, focus restoration,
   disabled behavior, and the published semantic role, name, value, states, and actions. State what
   the component does **not** claim. A Button group is not a radio group with arrow navigation
   unless it actually implements that contract.
5. **`testui` conformance examples.** Include positive tests for keyboard, pointer, and semantic
   activation parity; focus and selection continuity; removal, reorder, and disabled behavior; and
   an idle-settle assertion. Use `testui.pattern_check` where a documented pattern fits, and add a
   negative control that fails at a named contract step.

### Behaviors are ordinary Odin procedures

There is no component base type, lifecycle registry, event bus, or second widget tree. A component
is:

- a state value the caller owns and passes by pointer;
- procedures that describe its parts and return one controlled result;
- input routed through existing scopes (`ui.interaction_scope`, text targets, `ui.after_frame`) and
  existing semantic facilities.

Return a `bool` for a simple value change, a typed event when callers must distinguish several
actions, and an explicit status or result for fallible operations. Add `init`/`destroy` only when
the component owns resources.

## The two-consumer extraction rule

Extract a component when a second real consumer needs the same behavior, and not before. The first
consumer is the application that motivated the work; the second proves the contract is reusable
rather than application policy wearing a package name. AliKit pages record the split per component
so that a reader can see which layer owns each decision.

## Documentation template

Every catalog page follows the same order. The [component registry](/docs/reference/manifest/)
carries the same fields in machine-readable form.

| Section | Must state |
| --- | --- |
| Preview | The native capture and the exact Alicorn revision it was taken at. |
| Responsibility split | What Alicorn, the package, and the application own. |
| Installation | The import path and collection arguments, plus the copy recipe. |
| Copyable implementation | A runnable call site and the files that make it complete. |
| Compose the parts | The parts path for applications that own the shell. |
| Parts and identities | Stable keys, what may be omitted, and what replacement is allowed. |
| Styling, motion, and theme | Recipe roles, core fallbacks, and setup-time validation. |
| Keyboard and accessibility contract | Inputs, published semantics, focus owner, and non-claims. |
| Conformance tests | The `testui` coverage and the reproducible command. |
| API reference | Public types and procedures. |
| Limits | Explicit non-claims and known core gaps. |
| Compatibility | The pinned Alicorn revision. |
| Source map | Links to the package, tests, examples, theme data, and guide. |

## Before calling a component done

- The copied source builds outside the collection topology.
- Every part can be omitted or replaced without changing sibling identities.
- The theme contract reports configured and missing roles.
- Keyboard, pointer, and semantic activation produce the same one-shot result.
- The final turn has no remaining description or presentation work.
- The page states the capture revision and every known limit.
