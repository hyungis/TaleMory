-- Add async AI translation jobs for storyboard page Korean text edits.

ALTER TABLE `story_generation_jobs`
    MODIFY COLUMN `job_type`
        ENUM(
            'STORYBOARD',
            'ILLUSTRATION',
            'TTS',
            'BGM',
            'VOICE_CLONE',
            'STORY',
            'STORYBOARD_STORY',
            'STORYBOARD_IMAGE',
            'STORYBOARD_STORY_SUMMARY',
            'STORYBOARD_IMAGE_REGENERATE',
            'FINAL_ILLUSTRATION',
            'STORY_SENTENCE_TRANSLATION'
        ) NOT NULL COMMENT '작업 유형';
