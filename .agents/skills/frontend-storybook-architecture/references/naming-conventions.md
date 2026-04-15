# Naming Conventions

## General Naming

Use these defaults:

- directories: `kebab-case`
- components: `PascalCase`
- variables: `camelCase`
- functions: `camelCase`
- hooks: `camelCase` starting with `use`

## Directory Naming

Use domain and feature directories in `kebab-case`.

Good:
```text
story-creation
photo-manager
voice-clone
word-dictionary
```

Avoid:
```text
storyCreation
PhotoManager
word_dictionary
```

## File Naming

Prefer descriptive names that show responsibility.

Good:
```text
PhotoUploadSection.tsx
StoryboardGrid.tsx
useStoryboardEditor.ts
generateStoryboard.ts
routeConfig.ts
```

Avoid vague names such as:
```text
Page.tsx
Item.tsx
Data.ts
Info.ts
helper.ts
util.ts
```

Use generic names only when the scope is already extremely local and obvious.

## Component Naming

Use `PascalCase` and include the role of the component.

Good:
- `PhotoUploadSection`
- `StoryboardEditor`
- `ViewerToolbar`
- `FinalPreviewPanel`

Avoid:
- `photoUploadSection`
- `storyboard-editor`
- `Panel`
- `ItemBox`

Prefer names that tell what the component does in the domain.

## Function and Variable Naming

Use `camelCase`.

Good:
- `movePage`
- `uploadPhoto`
- `generateStoryboard`
- `saveBookmark`
- `selectedVoiceProfile`

Avoid:
- `pageMove`
- `UploadPhoto`
- `storyboardGenerator`
- `CurrentPage`

Prefer action-oriented names for functions and explicit meaning for variables.

## React Query Naming

Make HTTP intent explicit in hook names.

Use:
- reads: `Query`
- creates: `Post`
- deletes: `Delete`
- updates: `Update`

Examples:
- `useStoryListQuery`
- `useStoryboardPagesQuery`
- `useVoiceProfilesQuery`
- `useStoryPost`
- `usePhotoUploadPost`
- `useBookmarkDelete`
- `useStoryProgressUpdate`

Avoid names that hide intent:
- `useStory`
- `usePhotoAction`
- `useBookmarkThing`
- `SceneListQuery.ts`

## API File Naming

Prefer file names that describe the domain action clearly.

Use these defaults:

- reads: `getX`
- creates: domain action names such as `createX`, `uploadX`, `publishX`, `regenerateX`
- updates: `updateX`
- deletes: `deleteX`

Good:
```text
getSceneList.ts
uploadPhoto.ts
publishStory.ts
regenerateIllustration.ts
updateStoryProgress.ts
deleteBookmark.ts
```

Avoid overly mechanical names such as:
```text
postScene.ts
postIllustrationRegenerate.ts
putStoryProgress.ts
deleteThing.ts
```

Prefer names that answer "what does this API do in the domain" rather than only "which HTTP verb does it use".

## Export Naming

Expose stable public names from `index.ts`.

Good exports:
- `StoryboardEditor`
- `useStoryboardPagesQuery`
- `StoryboardEditorPage`

Avoid exporting:
- internal stores
- file-local helpers
- unstable implementation details
- deep model internals not intended for external use

## Naming Heuristics

Before finalizing a name, ask:
- does this name reveal domain meaning
- does this name reveal whether it is UI, state, or API related
- does this name match the project's casing rules
- does this name expose HTTP intent when using React Query
- is this name still understandable outside the local file
