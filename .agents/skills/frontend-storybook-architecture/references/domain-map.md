# Domain Map

## Top-Level Domains

Use these top-level frontend domains by default:

- `story-creation`
- `bookshelf`
- `viewer`
- `auth`
- `mypage`

Prefer domain ownership over technical grouping.

## `story-creation`

Use `story-creation` for story authoring, drafting, generation, editing, and publishing workflow.

Treat `story-creation` as the primary workflow domain in this project.

Typical subfeatures:
- `basic-info`
- `photo-manager`
- `storyboard-editor`
- `style-selector`
- `voice-clone`
- `final-preview`
- `publish-story`

Put code here when it is about:
- creating a story
- editing creation inputs
- generating storyboard or media during creation
- configuring style, voice, or preview state
- publishing the final story
- coordinating multi-step creation flow
- selecting a child profile during story creation
- creating a child profile inline during story creation when needed
- selecting or generating a voice profile during story creation

Use `story-creation/model` only for state shared across multiple creation steps or subfeatures.

Do not scatter cross-step creation state into individual pages.

Do not treat child profile and voice profile management as owned by `story-creation`. Story creation may create or select them inline as part of the workflow, but long-term ownership and management belong to `mypage`.

## `bookshelf`

Use `bookshelf` for saved story collection and management behavior.

Typical subfeatures:
- `story-list`
- `story-filter`
- `story-sort`
- `bookmark-story`
- `delete-story`

Put code here when it is about:
- listing owned or saved stories
- filtering or sorting stories
- bookmarking stories from collection views
- deleting stories from management views

Do not put reading or playback behavior here. That belongs to `viewer`.

## `viewer`

Use `viewer` for story consumption behavior.

Typical subfeatures:
- `story-reader`
- `tts-player`
- `translation`
- `word-dictionary`
- `progress-bookmark`
- `highlight`

Put code here when it is about:
- reading a story
- TTS playback
- translation while viewing
- word lookup or dictionary interaction
- progress saving during reading
- highlighting or active reading assistance

Do not put story authoring behavior here. That belongs to `story-creation`.

## `auth`

Use `auth` for account entry and access flows.

Typical subfeatures:
- `login`
- `signup`
- `oauth`
- `terms`

Put code here when it is about:
- entering the app
- authenticating a user
- agreeing to required terms
- social sign-in or account access

Do not put profile editing here. That belongs to `mypage`.

## `mypage`

Use `mypage` for user-owned account and asset management.

Typical subfeatures:
- `profile-edit`
- `child-manager`
- `voice-profile-manager`
- `withdrawal`

Put code here when it is about:
- editing account profile
- creating, editing, listing, and deleting child profiles
- creating, editing, listing, and deleting saved voice profiles
- maintaining user-owned assets outside the story creation flow
- account withdrawal or account maintenance

Treat child profiles and voice profiles as user-owned assets managed by `mypage`.

If the same child or voice data is used inside story creation, story creation should consume or create it as part of the workflow, but ownership and long-term management still belong to `mypage`.

## Boundary Rules

Use these rules when ownership is unclear:

- if the code belongs to story authoring or creation flow, prefer `story-creation`
- if the code belongs to story consumption, prefer `viewer`
- if the code belongs to saved story management, prefer `bookshelf`
- if the code belongs to account entry, prefer `auth`
- if the code belongs to user-owned asset management such as child profiles or voice profiles, prefer `mypage`

If the same domain concept appears in multiple features, place the shared data representation in `entities`, not in a page.

Use this distinction for child and voice related behavior:
- if the user is managing their saved assets, prefer `mypage`
- if the user is selecting or quickly creating an asset during story creation, prefer `story-creation`

## Page Role

Pages should stay thin.

Use pages for:
- route entry
- layout composition
- top-level assembly
- minimal route guards

Do not put detailed feature logic in pages.

## Feature Shape

A typical feature may use this structure:

```text
feature-name/
  api/
  model/
  ui/
  lib/
  types.ts
  index.ts
```

Use this shape by default unless the feature is clearly smaller or larger.

## Entity Examples

Typical entity candidates in this project include:
- `user`
- `child`
- `story`
- `photo`
- `storyboard-page`
- `scene`
- `sentence`
- `voice-profile`
- `style-preset`
- `bgm-preset`
- `story-progress`

Use entities for shared domain representations, not for user flow orchestration.
