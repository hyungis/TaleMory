ALTER TABLE `users`
    ADD COLUMN `onboarding_completed` BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Whether the onboarding tutorial has been completed or dismissed'
        AFTER `agree_marketing`;
