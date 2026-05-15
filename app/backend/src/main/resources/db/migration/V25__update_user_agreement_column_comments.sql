ALTER TABLE `users`
    CHANGE COLUMN `agree_sms` `agree_privacy` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '개인정보 수집 및 이용 동의',
    CHANGE COLUMN `agree_marketing` `agree_service_terms` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '서비스 이용약관 동의';
