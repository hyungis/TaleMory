# Architecture Rules

## Core Principle

Use feature-first, domain-oriented structure.

Prefer organizing by user-facing domain and feature before technical layer. Avoid generic top-level buckets such as global `components`, `hooks`, or `api` unless they are truly shared.

## Layer Placement

Use these placement rules:

- `pages`: route composition, layout assembly, page entry, thin orchestration
- `features`: user actions, workflow logic, feature behavior, interaction handling
- `entities`: domain data concepts, reusable domain representations
- `shared`: truly common UI, utilities, hooks, constants, common API infrastructure

Prefer feature-local placement first.

## `pages`

Use `pages` for:
- route entry
- layout composition
- feature assembly
- route guards
- thin initialization tied to page entry

Do not put these directly in `pages`:
- detailed business logic
- feature-specific validation
- direct API implementation
- deep workflow state
- reusable domain behavior

A page should compose features, not become the feature.

## `features`

Use `features` for:
- user actions
- step-based flows
- screen-level business behavior
- domain-specific interaction logic
- feature-owned API usage
- feature-owned local state and helpers

A feature may use this default shape:

```text
feature-name/
  api/
  model/
  ui/
  lib/
  types.ts
  index.ts
```

Use this as a default, not a rigid template.

## `entities`

Use `entities` for:
- domain data concepts
- reusable domain types
- data-level representations used by multiple features
- mappers or helpers tightly coupled to a domain concept

Do not put these in `entities`:
- feature workflows
- page assembly
- user flow orchestration
- action-heavy UI behavior

If the code represents "what the data is", prefer `entities`.
If the code represents "what the user is doing", prefer `features`.

## `shared`

Use `shared` only when all of these are true:

- the code is actually reused across multiple features or domains
- the code has weak domain specificity
- the code remains understandable outside its original feature context
- moving it improves clarity instead of just reducing duplication

Good candidates:
- UI primitives
- generic form helpers
- common hooks with weak domain coupling
- common API client/base response handling
- generic constants and utilities

Bad candidates:
- story-creation-only validation
- viewer-only formatter logic
- feature-specific query keys
- helpers that still carry domain assumptions from one feature

Do not move code to `shared` only because it might become reusable later.

## Public API Rule

External modules must not import feature internals directly.

Prefer:
```ts
import { StoryboardEditorPage } from "@/features/story-creation/storyboard-editor";
```

Avoid:
```ts
import { useInternalStoryEditorStore } from "@/features/story-creation/storyboard-editor/model/internal-store";
```

Expose only stable public items through each feature's `index.ts`.

Use `index.ts` to:
- hide internal file structure
- preserve refactor freedom
- control what is public
- reduce accidental coupling

## Dependency Direction

Follow this dependency direction:

- `pages` -> `features`, `entities`, `shared`
- `features` -> `entities`, `shared`
- `entities` -> `shared`
- `shared` -> no upward dependency

Do not break this direction without a strong project-specific reason.

## State Ownership

Separate state by responsibility:

- server state: remote data lifecycle, cached data, fetching, mutation
- UI state: modal open state, selection, local form input, temporary interaction state
- workflow state: multi-step flow state shared across subfeatures

Use React Query for server state.
Use local component state or feature model state for UI state.
Use higher-level domain model state only when multiple subfeatures need shared workflow coordination.

Do not mix all three in page components.

## Workflow State Exception

Use `story-creation/model` only for workflow state shared across multiple story-creation subfeatures or steps.

Good candidates:
- current creation step
- `storyId`
- story-level draft context
- selected child reused across multiple steps
- selected voice profile reused across multiple steps
- cross-step generation or publish progress
- state needed by more than one story-creation subfeature

Do not place these in `story-creation/model`:
- feature-local modal open state
- tab state
- hover state
- temporary input state used by one screen only
- editor-local selection state used by one subfeature only

Keep feature-local UI and interaction state inside the owning feature.

## Refactoring Defaults

When refactoring:
- preserve behavior first
- improve domain placement before introducing abstraction
- prefer reducing boundary confusion over reducing file count
- prefer local duplication over premature shared extraction
- stop when the structure becomes clearer, not when it becomes maximally abstract
