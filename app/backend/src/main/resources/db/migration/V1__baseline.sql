-- =====================================================================
-- 영어 동화 학습 서비스 - 전체 스키마 baseline (MySQL 8.0+)
-- V1 컬럼 구조 기준 + AUTO_INCREMENT / FK / UNIQUE / INDEX 보강
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- =====================================================================
-- terms
-- =====================================================================
CREATE TABLE `terms` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '약관 PK',
    `type`            VARCHAR(50)  NOT NULL                COMMENT '약관 종류',
    `version`         INT          NOT NULL                COMMENT '약관 버전',
    `title`           VARCHAR(200) NOT NULL                COMMENT '약관 제목',
    `content`         MEDIUMTEXT   NOT NULL                COMMENT '약관 본문',
    `is_required`     BOOLEAN      NOT NULL DEFAULT FALSE  COMMENT '필수 동의 여부',
    `effective_at`    DATETIME     NOT NULL                COMMENT '시행일',
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_terms_type_version` (`type`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- users
-- =====================================================================
CREATE TABLE `users` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
    `login_id`        VARCHAR(50)  NULL                    COMMENT '로그인 아이디',
    `password_hash`   VARCHAR(255) NULL                    COMMENT '비밀번호 해시 (OAuth 전용 NULL)',
    `email`           VARCHAR(255) NOT NULL                COMMENT '이메일',
    `name`            VARCHAR(100) NOT NULL                COMMENT '실명',
    `nickname`        VARCHAR(100) NOT NULL                COMMENT '닉네임',
    `phone`           VARCHAR(20)  NULL                    COMMENT '휴대폰 (선택)',
    `agree_sms`       BOOLEAN      NOT NULL DEFAULT FALSE  COMMENT 'SMS 수신 동의',
    `agree_marketing` BOOLEAN      NOT NULL DEFAULT FALSE  COMMENT '마케팅 동의',
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`      DATETIME     NULL                    COMMENT 'soft delete',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_email` (`email`),
    KEY `idx_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- oauth_accounts
-- =====================================================================
CREATE TABLE `oauth_accounts` (
    `id`                BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `user_id`           BIGINT       NOT NULL                COMMENT '사용자 FK',
    `provider`          VARCHAR(30)  NOT NULL                COMMENT 'kakao/google/naver',
    `provider_user_id`  VARCHAR(255) NOT NULL                COMMENT '제공자 발급 식별자',
    `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `deleted_at`        DATETIME     NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_oauth_provider_uid` (`provider`, `provider_user_id`),
    KEY `idx_oauth_user_id` (`user_id`),
    CONSTRAINT `fk_oauth_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- persons
-- =====================================================================
CREATE TABLE `persons` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '인물 PK',
    `user_id`     BIGINT       NOT NULL                COMMENT '소유 사용자 FK',
    `name`        VARCHAR(100) NOT NULL                COMMENT '인물 이름',
    `birth_date`  DATE         NOT NULL                COMMENT '생년월일',
    `gender`      VARCHAR(20)  NOT NULL                COMMENT 'male/female/other',
    `role`        VARCHAR(20)  NOT NULL DEFAULT 'child' COMMENT 'child/companion',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`  DATETIME     NULL,
    PRIMARY KEY (`id`),
    KEY `idx_persons_user_id` (`user_id`),
    KEY `idx_persons_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_persons_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- voice_profiles
-- =====================================================================
CREATE TABLE `voice_profiles` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `user_id`       BIGINT       NOT NULL                COMMENT '소유 사용자 FK',
    `title`         VARCHAR(100) NOT NULL                COMMENT '예: 엄마 목소리',
    `audio_url`     VARCHAR(500) NULL                    COMMENT '원본 녹음 파일 URL',
    `tts_voice_url` VARCHAR(500) NULL                    COMMENT 'TTS voice URL',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`    DATETIME     NULL,
    PRIMARY KEY (`id`),
    KEY `idx_voice_user_id` (`user_id`),
    KEY `idx_voice_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_voice_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- style_presets
-- =====================================================================
CREATE TABLE `style_presets` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `code`        VARCHAR(50)  NOT NULL                COMMENT 'watercolor/line_drawing/collage/cartoon/digital',
    `name`        VARCHAR(100) NOT NULL                COMMENT '표시명',
    `preview_url` VARCHAR(500) NULL                    COMMENT '프리뷰 이미지',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_style_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- bgm_presets
-- =====================================================================
CREATE TABLE `bgm_presets` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `code`      VARCHAR(50)  NOT NULL                COMMENT '코드',
    `name`      VARCHAR(100) NOT NULL                COMMENT '표시명',
    `audio_url` VARCHAR(500) NOT NULL                COMMENT '음원 URL',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bgm_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- stories
-- =====================================================================
CREATE TABLE `stories` (
    `id`                 BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `user_id`            BIGINT       NOT NULL                COMMENT '작성자 FK',
    `style_preset_id`    BIGINT       NULL                    COMMENT '삽화 스타일 FK',
    `bgm_preset_id`      BIGINT       NULL                    COMMENT 'BGM FK',
    `voice_profile_id`   BIGINT       NULL                    COMMENT '보이스 프로필 FK',
    `title`              VARCHAR(200) NULL                    COMMENT '동화 제목',
    `synopsis`           TEXT         NULL                    COMMENT '전체 줄거리 (스토리보드 단계에서 작성)',
    `difficulty`         ENUM('BEGINNER','INTERMEDIATE','ADVANCED') NOT NULL DEFAULT 'BEGINNER' COMMENT '영어 난이도',
    `status`             ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT' COMMENT '상태',
    `share_token`        VARCHAR(64)  NULL                    COMMENT '공유 토큰 (영구)',
    `is_bookmarked`      BOOLEAN      NOT NULL DEFAULT FALSE  COMMENT '즐겨찾기',
    `companions_json`    JSON         NOT NULL,
    `main_character_json` JSON        NOT NULL,
    `travel_place`       VARCHAR(255) NULL,
    `travel_start_date`  DATE         NULL,
    `travel_end_date`    DATE         NULL,
    `published_at`       DATETIME     NULL                    COMMENT '완성 시각',
    `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`         DATETIME     NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_stories_share_token` (`share_token`),
    KEY `idx_stories_user_id` (`user_id`),
    KEY `idx_stories_status` (`status`),
    KEY `idx_stories_difficulty` (`difficulty`),
    KEY `idx_stories_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_stories_user`  FOREIGN KEY (`user_id`)          REFERENCES `users`(`id`),
    CONSTRAINT `fk_stories_style` FOREIGN KEY (`style_preset_id`)  REFERENCES `style_presets`(`id`),
    CONSTRAINT `fk_stories_bgm`   FOREIGN KEY (`bgm_preset_id`)    REFERENCES `bgm_presets`(`id`),
    CONSTRAINT `fk_stories_voice` FOREIGN KEY (`voice_profile_id`) REFERENCES `voice_profiles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- photo_album_items
-- =====================================================================
CREATE TABLE `photo_album_items` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `story_id`      BIGINT       NOT NULL                COMMENT '소속 동화 FK',
    `image_url`     VARCHAR(500) NOT NULL                COMMENT '원본 이미지 URL',
    `purpose`       ENUM('CHARACTER_REF','STORYBOARD','BOTH') NOT NULL DEFAULT 'BOTH' COMMENT '사진 용도',
    `description`   VARCHAR(500) NULL                    COMMENT '사진 설명',
    `tags_json`     JSON         NULL                    COMMENT '해시태그',
    `taken_at`      DATETIME     NULL                    COMMENT 'EXIF 촬영 시각',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`    DATETIME     NULL,
    `display_order` BIGINT       NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_photo_story_id` (`story_id`),
    KEY `idx_photo_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_photo_story` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- story_board
-- =====================================================================
CREATE TABLE `story_board` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT,
    `story_id`   BIGINT       NOT NULL                COMMENT 'PK',
    `prompt`     VARCHAR(255) NOT NULL,
    `story`      VARCHAR(255) NOT NULL,
    `create_at`  DATE         NOT NULL,
    `update_at`  DATE         NULL,
    `deleted_at` DATE         NULL,
    PRIMARY KEY (`id`),
    KEY `idx_sb_story_id` (`story_id`),
    CONSTRAINT `fk_sb_story` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- storyboard_pages
-- =====================================================================
CREATE TABLE `storyboard_pages` (
    `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `story_board_id` BIGINT       NOT NULL,
    `page_number`    INT          NOT NULL                COMMENT '페이지 번호 (1부터)',
    `english_text`   TEXT         NULL                    COMMENT '영어 본문 (페이지 통문)',
    `korean_text`    TEXT         NULL                    COMMENT '한글 번역 (페이지 통문)',
    `image_url`      VARCHAR(500) NULL                    COMMENT '스토리보드 그림 URL (S3)',
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sbp_board_page` (`story_board_id`, `page_number`),
    CONSTRAINT `fk_sbp_board` FOREIGN KEY (`story_board_id`) REFERENCES `story_board`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- scenes
-- =====================================================================
CREATE TABLE `scenes` (
    `id`                BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `story_id`          BIGINT       NOT NULL                COMMENT '동화 FK',
    `page_number`       INT          NOT NULL                COMMENT '페이지 번호 (1부터)',
    `illustration_url`  VARCHAR(500) NULL                    COMMENT '최종 삽화 URL',
    `character_anchors` JSON         NULL,
    `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_scene_story_page` (`story_id`, `page_number`),
    CONSTRAINT `fk_scene_story` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- scene_sentences
-- =====================================================================
CREATE TABLE `scene_sentences` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `scene_id`        BIGINT       NOT NULL                COMMENT '소속 페이지 FK',
    `sentence_order`  INT          NOT NULL                COMMENT '문장 순서 (1부터)',
    `english_text`    TEXT         NOT NULL                COMMENT '영어 문장',
    `korean_text`     TEXT         NULL                    COMMENT '한글 번역 문장',
    `tts_audio_url`   VARCHAR(500) NULL                    COMMENT '문장 TTS 오디오 URL',
    `speaker_key`     VARCHAR(50)  NULL,
    `bubble_slot`     ENUM('TOP_LEFT','TOP_CENTER','TOP_RIGHT',
                           'MIDDLE_LEFT','MIDDLE_CENTER','MIDDLE_RIGHT',
                           'BOTTOM_LEFT','BOTTOM_CENTER','BOTTOM_RIGHT') NULL,
    `has_highlighted` BOOLEAN      NOT NULL,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sentence_scene_order` (`scene_id`, `sentence_order`),
    CONSTRAINT `fk_sentence_scene` FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- scene_highlight_voices
-- =====================================================================
CREATE TABLE `scene_highlight_voices` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `sentence_id` BIGINT       NOT NULL                COMMENT '대상 문장 FK (1:1)',
    `audio_url`   VARCHAR(500) NOT NULL                COMMENT '사용자 녹음 URL',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`  DATETIME     NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_shv_sentence_id` (`sentence_id`),
    KEY `idx_shv_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_shv_sentence` FOREIGN KEY (`sentence_id`) REFERENCES `scene_sentences`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- story_outros
-- =====================================================================
CREATE TABLE `story_outros` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `story_id`   BIGINT       NOT NULL                COMMENT '동화 FK (1:1)',
    `outro_text` TEXT         NOT NULL                COMMENT '마무리 멘트 텍스트',
    `audio_url`  VARCHAR(500) NULL                    COMMENT '마무리 멘트 오디오',
    `signature`  VARCHAR(100) NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME     NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_story_outros_story_id` (`story_id`),
    KEY `idx_story_outros_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_outro_story` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- story_progress
-- =====================================================================
CREATE TABLE `story_progress` (
    `id`              BIGINT   NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `user_id`         BIGINT   NOT NULL                COMMENT '사용자 FK',
    `story_id`        BIGINT   NOT NULL                COMMENT '동화 FK',
    `last_scene_page` INT      NOT NULL DEFAULT 1      COMMENT '마지막 본 페이지',
    `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_progress_user_story` (`user_id`, `story_id`),
    KEY `idx_progress_story` (`story_id`),
    CONSTRAINT `fk_progress_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`),
    CONSTRAINT `fk_progress_story` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- word_dictionary
-- =====================================================================
CREATE TABLE `word_dictionary` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `word`          VARCHAR(100) NOT NULL                COMMENT '영어 단어 (소문자)',
    `pos`           VARCHAR(20)  NULL                    COMMENT '품사',
    `meaning_json`  JSON         NOT NULL                COMMENT '한글 뜻 배열',
    `pronunciation` VARCHAR(255) NULL                    COMMENT '발음 기호',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_word` (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- story_generation_jobs
-- =====================================================================
CREATE TABLE `story_generation_jobs` (
    `id`              BIGINT        NOT NULL AUTO_INCREMENT COMMENT 'PK',
    `story_id`        BIGINT        NOT NULL                COMMENT '동화 FK',
    `sentence_id`     BIGINT        NULL                    COMMENT '특정 문장 대상일 때',
    `scene_id`        BIGINT        NULL                    COMMENT '특정 페이지 대상일 때',
    `job_type`        ENUM('STORYBOARD','ILLUSTRATION','TTS','BGM','VOICE_CLONE','STORY') NOT NULL COMMENT '작업 종류',
    `status`          ENUM('PENDING','RUNNING','SUCCESS','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING' COMMENT '상태',
    `request_payload` JSON          NULL                    COMMENT '요청 파라미터',
    `result_payload`  JSON          NULL                    COMMENT '결과 데이터',
    `error_message`   TEXT          NULL                    COMMENT '실패 에러',
    `cost_usd`        DECIMAL(10,4) NULL                    COMMENT 'API 비용',
    `started_at`      DATETIME      NULL,
    `finished_at`     DATETIME      NULL,
    `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_jobs_story_id` (`story_id`),
    KEY `idx_jobs_status` (`status`),
    KEY `idx_jobs_type_status` (`job_type`, `status`),
    CONSTRAINT `fk_jobs_story`    FOREIGN KEY (`story_id`)    REFERENCES `stories`(`id`),
    CONSTRAINT `fk_jobs_scene`    FOREIGN KEY (`scene_id`)    REFERENCES `scenes`(`id`),
    CONSTRAINT `fk_jobs_sentence` FOREIGN KEY (`sentence_id`) REFERENCES `scene_sentences`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


SET FOREIGN_KEY_CHECKS = 1;
