# Review Checklist

Check these before finishing:

- does this code belong to the correct domain
- is the placement correct across `pages`, `features`, `entities`, and `shared`
- is `shared` still truly shared
- are external imports going through `index.ts`
- are page components still thin
- are server state and UI state separated
- is workflow state stored in the right place
- do names follow directory, component, and React Query conventions
- does this change preserve domain boundaries

## Domain Review

Ask:
- does this belong to `story-creation`, `bookshelf`, `viewer`, `auth`, or `mypage`
- is this feature crossing into another domain without a good reason
- is this actually a shared data concept that should live in `entities`

## Placement Review

Ask:
- is this page doing more than routing and composition
- is this user-facing behavior in `features`
- is this data representation in `entities`
- is this code only in `shared` because it looks reusable

Prefer moving code down to the owning feature instead of up to a broad shared location.

## Public API Review

Ask:
- is any external code importing deep internal files directly
- should this item really be public
- is `index.ts` exposing only stable public items

If a feature is hard to use without deep imports, improve the feature's public API instead of normalizing deep imports.

## State Review

Ask:
- is this server state, UI state, or workflow state
- is React Query being used for remote data lifecycle
- is page-level state holding too much feature detail
- should cross-step creation state live in `story-creation/model`
- is `story-creation/model` holding only cross-step workflow state, not feature-local UI state

Do not let a page become the central state owner for unrelated feature concerns.

## Naming Review

Ask:
- does this directory use `kebab-case`
- does this component use `PascalCase`
- do functions and variables use `camelCase`
- do React Query hooks reveal intent with `Query`, `Post`, `Delete`, or `Update`
- do API file names describe domain action clearly
- is the name specific enough to understand responsibility

## Good vs Bad Signals

Good signals:
- thin pages
- feature-local logic
- stable `index.ts` exports
- minimal `shared`
- domain-first placement
- explicit names

Bad signals:
- direct imports from internal feature files
- shared folders accumulating domain-specific helpers
- pages owning workflow logic
- generic names like `Data`, `Info`, `Item`
- React Query hooks that hide HTTP intent
- `story-creation/model` accumulating feature-local UI state

## Final Gate

Do not consider the structure complete unless:
- domain ownership is clear
- layer placement is explainable
- imports respect public boundaries
- state ownership is explicit
- naming matches the conventions
