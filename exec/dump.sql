-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: k14s210.p.ssafy.io    Database: iportfolio
-- ------------------------------------------------------
-- Server version	8.4.9

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `bgm_presets`
--

DROP TABLE IF EXISTS `bgm_presets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bgm_presets` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `code` varchar(50) NOT NULL COMMENT '코드',
  `name` varchar(100) NOT NULL COMMENT '표시명',
  `audio_url` varchar(500) NOT NULL COMMENT '음원 URL',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bgm_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `flyway_schema_history`
--

DROP TABLE IF EXISTS `flyway_schema_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flyway_schema_history` (
  `installed_rank` int NOT NULL,
  `version` varchar(50) DEFAULT NULL,
  `description` varchar(200) NOT NULL,
  `type` varchar(20) NOT NULL,
  `script` varchar(1000) NOT NULL,
  `checksum` int DEFAULT NULL,
  `installed_by` varchar(100) NOT NULL,
  `installed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time` int NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`installed_rank`),
  KEY `flyway_schema_history_s_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `oauth_accounts`
--

DROP TABLE IF EXISTS `oauth_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_accounts` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `user_id` bigint NOT NULL COMMENT '사용자 FK',
  `provider` varchar(30) NOT NULL COMMENT 'kakao/google/naver',
  `provider_user_id` varchar(255) NOT NULL COMMENT '제공자 발급 식별자',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_oauth_provider_uid` (`provider`,`provider_user_id`),
  KEY `idx_oauth_user_id` (`user_id`),
  CONSTRAINT `fk_oauth_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `persons`
--

DROP TABLE IF EXISTS `persons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `persons` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '인물 PK',
  `user_id` bigint NOT NULL COMMENT '소유 사용자 FK',
  `name` varchar(100) NOT NULL COMMENT '인물 이름',
  `age` int NOT NULL COMMENT '만 나이 (FE 입력값 그대로 보존)',
  `gender` varchar(20) NOT NULL COMMENT 'male/female/other',
  `role` varchar(20) NOT NULL DEFAULT 'child' COMMENT 'child/companion',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_persons_user_id` (`user_id`),
  KEY `idx_persons_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_persons_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `photo_album_items`
--

DROP TABLE IF EXISTS `photo_album_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photo_album_items` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `story_id` bigint NOT NULL COMMENT '소속 동화 FK',
  `image_url` varchar(500) NOT NULL COMMENT '원본 이미지 URL',
  `purpose` enum('CHARACTER_REF','STORYBOARD','BOTH') NOT NULL DEFAULT 'BOTH' COMMENT '사진 용도',
  `description` varchar(500) DEFAULT NULL COMMENT '사진 설명',
  `tags_json` json DEFAULT NULL COMMENT '해시태그',
  `taken_at` datetime DEFAULT NULL COMMENT 'EXIF 촬영 시각',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `display_order` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_photo_story_id` (`story_id`),
  KEY `idx_photo_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_photo_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1376 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scene_highlight_voices`
--

DROP TABLE IF EXISTS `scene_highlight_voices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scene_highlight_voices` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `sentence_id` bigint NOT NULL COMMENT '대상 문장 FK (1:1)',
  `audio_url` varchar(500) NOT NULL COMMENT '사용자 녹음 URL',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shv_sentence_id` (`sentence_id`),
  KEY `idx_shv_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_shv_sentence` FOREIGN KEY (`sentence_id`) REFERENCES `scene_sentences` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scene_sentences`
--

DROP TABLE IF EXISTS `scene_sentences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scene_sentences` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `scene_id` bigint NOT NULL COMMENT '소속 페이지 FK',
  `sentence_order` int NOT NULL COMMENT '문장 순서 (1부터)',
  `english_text` text NOT NULL COMMENT '영어 문장',
  `korean_text` text COMMENT '한글 번역 문장',
  `tts_audio_url` varchar(500) DEFAULT NULL COMMENT '문장 TTS 오디오 URL',
  `speaker_key` varchar(50) DEFAULT NULL,
  `has_highlighted` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sentence_scene_order` (`scene_id`,`sentence_order`),
  CONSTRAINT `fk_sentence_scene` FOREIGN KEY (`scene_id`) REFERENCES `scenes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3768 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scenes`
--

DROP TABLE IF EXISTS `scenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scenes` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `story_id` bigint NOT NULL COMMENT '동화 FK',
  `page_number` int NOT NULL COMMENT '페이지 번호 (1부터)',
  `illustration_url` varchar(500) DEFAULT NULL COMMENT '최종 삽화 URL',
  `character_anchors` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scene_story_page` (`story_id`,`page_number`),
  CONSTRAINT `fk_scene_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1236 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stories`
--

DROP TABLE IF EXISTS `stories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stories` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `user_id` bigint NOT NULL COMMENT '작성자 FK',
  `style_preset_id` bigint DEFAULT NULL COMMENT '삽화 스타일 FK',
  `bgm_preset_id` bigint DEFAULT NULL COMMENT 'BGM FK',
  `voice_profile_id` bigint DEFAULT NULL COMMENT '보이스 프로필 FK',
  `title` varchar(200) DEFAULT NULL COMMENT '동화 제목',
  `synopsis` text COMMENT '전체 줄거리 (스토리보드 단계에서 작성)',
  `difficulty` enum('BEGINNER','INTERMEDIATE','ADVANCED') NOT NULL DEFAULT 'BEGINNER' COMMENT '영어 난이도',
  `status` enum('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT' COMMENT '상태',
  `share_token` varchar(64) DEFAULT NULL COMMENT '공유 토큰 (영구)',
  `is_bookmarked` tinyint(1) NOT NULL DEFAULT '0' COMMENT '즐겨찾기',
  `companions_json` json NOT NULL,
  `main_character_json` json NOT NULL,
  `travel_place` varchar(255) DEFAULT NULL,
  `travel_start_date` date DEFAULT NULL,
  `travel_end_date` date DEFAULT NULL,
  `published_at` datetime DEFAULT NULL COMMENT '완성 시각',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `mode` varchar(20) NOT NULL DEFAULT 'VIEWER' COMMENT '동화 생성 모드 — VIEWER(narration, 기본) / WEBTOON(대화)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stories_share_token` (`share_token`),
  KEY `idx_stories_user_id` (`user_id`),
  KEY `idx_stories_status` (`status`),
  KEY `idx_stories_difficulty` (`difficulty`),
  KEY `idx_stories_deleted_at` (`deleted_at`),
  KEY `fk_stories_style` (`style_preset_id`),
  KEY `fk_stories_bgm` (`bgm_preset_id`),
  KEY `fk_stories_voice` (`voice_profile_id`),
  CONSTRAINT `fk_stories_bgm` FOREIGN KEY (`bgm_preset_id`) REFERENCES `bgm_presets` (`id`),
  CONSTRAINT `fk_stories_style` FOREIGN KEY (`style_preset_id`) REFERENCES `style_presets` (`id`),
  CONSTRAINT `fk_stories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_stories_voice` FOREIGN KEY (`voice_profile_id`) REFERENCES `voice_profiles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=155 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `story_board`
--

DROP TABLE IF EXISTS `story_board`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `story_board` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `story_id` bigint NOT NULL COMMENT 'PK',
  `prompt` varchar(255) NOT NULL,
  `story` text NOT NULL COMMENT '한글 동화 본문 (pages.koreanText 를 이어붙인 원본)',
  `create_at` date NOT NULL,
  `update_at` date DEFAULT NULL,
  `deleted_at` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sb_story_id` (`story_id`),
  CONSTRAINT `fk_sb_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `story_generation_jobs`
--

DROP TABLE IF EXISTS `story_generation_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `story_generation_jobs` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `story_id` bigint NOT NULL COMMENT '동화 FK',
  `sentence_id` bigint DEFAULT NULL COMMENT '특정 문장 대상일 때',
  `scene_id` bigint DEFAULT NULL COMMENT '특정 페이지 대상일 때',
  `job_type` enum('STORYBOARD','ILLUSTRATION','TTS','BGM','VOICE_CLONE','STORY','STORYBOARD_STORY','STORYBOARD_IMAGE','STORYBOARD_STORY_SUMMARY','STORYBOARD_IMAGE_REGENERATE','FINAL_ILLUSTRATION','STORY_SENTENCE_TRANSLATION') NOT NULL COMMENT '작업 유형',
  `status` enum('PENDING','RUNNING','SUCCESS','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING' COMMENT '상태',
  `request_payload` json DEFAULT NULL COMMENT '요청 파라미터',
  `result_payload` json DEFAULT NULL COMMENT '결과 데이터',
  `error_message` text COMMENT '실패 에러',
  `cost_usd` decimal(10,4) DEFAULT NULL COMMENT 'API 비용',
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jobs_story_id` (`story_id`),
  KEY `idx_jobs_status` (`status`),
  KEY `idx_jobs_type_status` (`job_type`,`status`),
  KEY `fk_jobs_scene` (`scene_id`),
  KEY `fk_jobs_sentence` (`sentence_id`),
  CONSTRAINT `fk_jobs_scene` FOREIGN KEY (`scene_id`) REFERENCES `scenes` (`id`),
  CONSTRAINT `fk_jobs_sentence` FOREIGN KEY (`sentence_id`) REFERENCES `scene_sentences` (`id`),
  CONSTRAINT `fk_jobs_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=668 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `story_outros`
--

DROP TABLE IF EXISTS `story_outros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `story_outros` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `story_id` bigint NOT NULL COMMENT '동화 FK (1:1)',
  `outro_text` text NOT NULL COMMENT '마무리 멘트 텍스트',
  `audio_url` varchar(500) DEFAULT NULL COMMENT '마무리 멘트 오디오',
  `signature` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_story_outros_story_id` (`story_id`),
  KEY `idx_story_outros_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_outro_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=96 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `story_progress`
--

DROP TABLE IF EXISTS `story_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `story_progress` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `user_id` bigint NOT NULL COMMENT '사용자 FK',
  `story_id` bigint NOT NULL COMMENT '동화 FK',
  `last_scene_page` int NOT NULL DEFAULT '1' COMMENT '마지막 본 페이지',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_progress_user_story` (`user_id`,`story_id`),
  KEY `idx_progress_story` (`story_id`),
  CONSTRAINT `fk_progress_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`),
  CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `story_voice_assignments`
--

DROP TABLE IF EXISTS `story_voice_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `story_voice_assignments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `story_id` bigint NOT NULL,
  `speaker_key` varchar(50) NOT NULL,
  `speaker_name` varchar(100) DEFAULT NULL,
  `voice_profile_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_story_voice_assignments_story_speaker` (`story_id`,`speaker_key`),
  KEY `idx_story_voice_assignments_story_id` (`story_id`),
  KEY `idx_story_voice_assignments_voice_profile_id` (`voice_profile_id`),
  CONSTRAINT `fk_story_voice_assignments_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_story_voice_assignments_voice_profile` FOREIGN KEY (`voice_profile_id`) REFERENCES `voice_profiles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storyboard_pages`
--

DROP TABLE IF EXISTS `storyboard_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storyboard_pages` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `story_board_id` bigint NOT NULL,
  `page_number` int NOT NULL COMMENT '페이지 번호 (1부터)',
  `scene_summary` text COMMENT 'AI 생성 영어 장면 요약 (Gemini 입력용)',
  `image_prompt` text COMMENT 'AI 생성 영어 그림 프롬프트 (Gemini 입력용)',
  `sentences` json DEFAULT NULL COMMENT 'Page sentence array: [{sentenceOrder, englishText, koreanText, emotion}]',
  `image_url` varchar(500) DEFAULT NULL COMMENT '스토리보드 그림 URL (S3)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `characters_in_scene_json` json DEFAULT NULL COMMENT 'WEBTOON 모드 한정. 페이지 등장 캐릭터 메타 (characterKey/sceneRole/expectedPosition). VIEWER 모드는 NULL.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sbp_board_page` (`story_board_id`,`page_number`),
  CONSTRAINT `fk_sbp_board` FOREIGN KEY (`story_board_id`) REFERENCES `story_board` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1575 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `style_presets`
--

DROP TABLE IF EXISTS `style_presets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `style_presets` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `code` varchar(50) NOT NULL COMMENT 'watercolor/line_drawing/collage/cartoon/digital',
  `name` varchar(100) NOT NULL COMMENT '표시명',
  `preview_url` varchar(500) DEFAULT NULL COMMENT '프리뷰 이미지',
  `style_prompt` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_style_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `terms`
--

DROP TABLE IF EXISTS `terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `terms` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '약관 PK',
  `type` varchar(50) NOT NULL COMMENT '약관 종류',
  `version` int NOT NULL COMMENT '약관 버전',
  `title` varchar(200) NOT NULL COMMENT '약관 제목',
  `content` mediumtext NOT NULL COMMENT '약관 본문',
  `is_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT '필수 동의 여부',
  `effective_at` datetime NOT NULL COMMENT '시행일',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_terms_type_version` (`type`,`version`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
  `login_id` varchar(50) DEFAULT NULL COMMENT '로그인 아이디',
  `password_hash` varchar(255) DEFAULT NULL COMMENT '비밀번호 해시 (OAuth 전용 NULL)',
  `email` varchar(255) NOT NULL COMMENT '이메일',
  `name` varchar(100) NOT NULL COMMENT '실명',
  `nickname` varchar(100) NOT NULL COMMENT '닉네임',
  `phone` varchar(20) DEFAULT NULL COMMENT '휴대폰 (선택)',
  `agree_privacy` tinyint(1) NOT NULL DEFAULT '0' COMMENT '개인정보 수집 및 이용 동의',
  `agree_service_terms` tinyint(1) NOT NULL DEFAULT '0' COMMENT '서비스 이용약관 동의',
  `onboarding_completed` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether the onboarding tutorial has been completed or dismissed',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT 'soft delete',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `idx_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `voice_profiles`
--

DROP TABLE IF EXISTS `voice_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voice_profiles` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `user_id` bigint NOT NULL COMMENT '소유 사용자 FK',
  `title` varchar(100) NOT NULL COMMENT '예: 엄마 목소리',
  `audio_url` varchar(500) DEFAULT NULL COMMENT '원본 녹음 파일 URL',
  `tts_voice_url` varchar(500) DEFAULT NULL COMMENT 'TTS voice URL',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_voice_user_id` (`user_id`),
  KEY `idx_voice_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_voice_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `word_dictionary`
--

DROP TABLE IF EXISTS `word_dictionary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `word_dictionary` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'PK',
  `word` varchar(100) NOT NULL COMMENT '영어 단어 (소문자)',
  `pos` varchar(20) DEFAULT NULL COMMENT '품사',
  `definition_ko` text NOT NULL COMMENT '한글 뜻',
  `ipa` varchar(255) DEFAULT NULL COMMENT '발음 기호',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `forms` json DEFAULT NULL COMMENT '활용형 배열',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_word_pos` (`word`,`pos`)
) ENGINE=InnoDB AUTO_INCREMENT=138314 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-15 14:44:46
