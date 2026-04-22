// Domain entity types, shared across features.
// 각 엔티티는 자체 index.ts 로 public API 를 노출하고, 이 루트에서 type-only 재 export.

export type { AuthUser, UserProfile, OauthAccount, OauthProvider } from './user'
export type { Person, PersonRole } from './person'
export type { Photo, PhotoPurpose } from './photo'
export type { Scene, CharacterAnchor } from './scene'
export type { SceneSentence } from './sentence'
export type { StoryboardPage } from './storyboard-page'
export type { VoiceProfile } from './voice-profile'
export type { StylePreset, StylePresetCode } from './style-preset'
export type { BgmPreset } from './bgm-preset'
export type { StoryProgress } from './story-progress'

export type { Story, StoryLevel, StoryBadgeType } from './story'
export { DUMMY_STORIES } from './story'
