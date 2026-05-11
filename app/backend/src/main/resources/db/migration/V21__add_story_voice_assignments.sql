CREATE TABLE story_voice_assignments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    story_id BIGINT NOT NULL,
    speaker_key VARCHAR(50) NOT NULL,
    speaker_name VARCHAR(100) NULL,
    voice_profile_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_story_voice_assignments_story_speaker (story_id, speaker_key),
    KEY idx_story_voice_assignments_story_id (story_id),
    KEY idx_story_voice_assignments_voice_profile_id (voice_profile_id),
    CONSTRAINT fk_story_voice_assignments_story
        FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    CONSTRAINT fk_story_voice_assignments_voice_profile
        FOREIGN KEY (voice_profile_id) REFERENCES voice_profiles(id)
);
