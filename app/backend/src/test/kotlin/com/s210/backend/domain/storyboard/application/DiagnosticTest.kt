package com.s210.backend.domain.storyboard.application

import com.s210.backend.domain.storyboard.application.dto.StorySummaryResultEnvelope
import org.junit.jupiter.api.Test
import tools.jackson.module.kotlin.jacksonObjectMapper

class DiagnosticTest {
    @Test
    fun `diagnose StorySummaryResultEnvelope deserialization`() {
        val om = jacksonObjectMapper()
        val json = """{
            "jobId": "42",
            "type": "GENERATE_STORY_SUMMARY_COMPLETED",
            "status": "COMPLETED",
            "payload": {
                "title": "Test Title",
                "summary": "English summary",
                "summaryKo": "한글 요약",
                "moralTheme": "courage",
                "storyQuest": "find treasure",
                "recurringMotif": "rainbow",
                "readingLevel": "BEGINNER",
                "usage": {
                    "model": "gpt-4",
                    "inputTokens": 100,
                    "outputTokens": 200,
                    "totalTokens": 300,
                    "costUsd": 0.01,
                    "promptTemplateVersion": "v1"
                }
            }
        }"""
        val env = om.readValue(json, StorySummaryResultEnvelope::class.java)
        println("payload=${env.payload}")
        println("summaryKo=${env.payload?.summaryKo}")
        assert(env.payload != null) { "payload was null!" }
        assert(env.payload!!.summaryKo == "한글 요약") { "summaryKo wrong: ${env.payload!!.summaryKo}" }
    }
}
