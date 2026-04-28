package com.s210.backend.domain.storyboard.application

import com.s210.backend.domain.storyboard.application.dto.StorySummaryResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StoryResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageResultEnvelope
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * JSON deserialization drift-defense tests (AC10).
 *
 * Verifies that:
 * - All 4 envelope types (StorySummaryResultEnvelope x2, StoryResultEnvelope, StoryboardImageResultEnvelope)
 *   deserialize correctly from well-formed JSON
 * - Unknown extra fields in the JSON do NOT cause deserialization failure
 *   (@JsonIgnoreProperties(ignoreUnknown=true) is in effect)
 * - Required fields are mapped to the correct Kotlin properties
 */
class StorySummaryPayloadJsonTest {

    private val objectMapper = jacksonObjectMapper()

    // -----------------------------------------------------------------------
    // StorySummaryResultEnvelope — GENERATE_STORY_SUMMARY_COMPLETED
    // -----------------------------------------------------------------------

    @Test
    fun `GENERATE_STORY_SUMMARY_COMPLETED envelope deserializes correctly`() {
        val json = """
        {
            "jobId": "42",
            "type": "GENERATE_STORY_SUMMARY_COMPLETED",
            "status": "COMPLETED",
            "payload": {
                "title": "The Magic Journey",
                "summary": "A child explores a magical island",
                "summaryKo": "아이가 마법의 섬을 탐험합니다",
                "moralTheme": "courage",
                "storyQuest": "find the hidden treasure",
                "recurringMotif": "rainbow bridge",
                "keyEmotionalBeats": ["hopeful", "warm", "playful"],
                "usage": {
                    "model": "gpt-4o",
                    "inputTokens": 500,
                    "outputTokens": 300,
                    "totalTokens": 800,
                    "costUsd": 0.024,
                    "promptTemplateVersion": "v2"
                }
            }
        }
        """.trimIndent()

        val envelope = objectMapper.readValue(json, StorySummaryResultEnvelope::class.java)

        assertEquals("42", envelope.jobId)
        assertEquals("GENERATE_STORY_SUMMARY_COMPLETED", envelope.type)
        assertEquals("COMPLETED", envelope.status)
        assertNotNull(envelope.payload)
        assertEquals("The Magic Journey", envelope.payload!!.title)
        assertEquals("아이가 마법의 섬을 탐험합니다", envelope.payload.summaryKo)
        assertEquals("gpt-4o", envelope.payload.usage.model)
        assertEquals(0.024, envelope.payload.usage.costUsd!!, 1e-9)
        assertNull(envelope.error)
    }

    @Test
    fun `REGENERATE_STORY_SUMMARY_COMPLETED envelope deserializes correctly`() {
        val json = """
        {
            "jobId": "43",
            "type": "REGENERATE_STORY_SUMMARY_COMPLETED",
            "status": "COMPLETED",
            "payload": {
                "title": "The Brave Adventure",
                "summary": "A brave child overcomes fear",
                "summaryKo": "용감한 아이가 두려움을 극복합니다",
                "moralTheme": "bravery",
                "storyQuest": "defeat the dark shadow",
                "recurringMotif": "shooting star",
                "keyEmotionalBeats": ["brave", "hopeful", "triumphant"],
                "usage": {
                    "model": "gpt-4o",
                    "inputTokens": 600,
                    "outputTokens": 350,
                    "totalTokens": 950,
                    "costUsd": 0.028,
                    "promptTemplateVersion": "v2"
                }
            }
        }
        """.trimIndent()

        val envelope = objectMapper.readValue(json, StorySummaryResultEnvelope::class.java)

        assertEquals("43", envelope.jobId)
        assertEquals("REGENERATE_STORY_SUMMARY_COMPLETED", envelope.type)
        assertEquals("용감한 아이가 두려움을 극복합니다", envelope.payload!!.summaryKo)
    }

    @Test
    fun `GENERATE_STORY_SUMMARY_FAILED envelope deserializes correctly with error field`() {
        val json = """
        {
            "jobId": "44",
            "type": "GENERATE_STORY_SUMMARY_FAILED",
            "status": "FAILED",
            "error": {
                "code": "GENERATE_SUMMARY_ERROR",
                "message": "OpenAI API timeout"
            }
        }
        """.trimIndent()

        val envelope = objectMapper.readValue(json, StorySummaryResultEnvelope::class.java)

        assertEquals("44", envelope.jobId)
        assertEquals("FAILED", envelope.status)
        assertNull(envelope.payload)
        assertNotNull(envelope.error)
        assertEquals("GENERATE_SUMMARY_ERROR", envelope.error!!.code)
        assertEquals("OpenAI API timeout", envelope.error.message)
    }

    // -----------------------------------------------------------------------
    // StoryResultEnvelope — GENERATE_STORY_COMPLETED
    // -----------------------------------------------------------------------

    @Test
    fun `GENERATE_STORY_COMPLETED envelope deserializes correctly`() {
        val json = """
        {
            "jobId": "77",
            "type": "GENERATE_STORY_COMPLETED",
            "storyId": 10,
            "status": "COMPLETED",
            "payload": null
        }
        """.trimIndent()

        val envelope = objectMapper.readValue(json, StoryResultEnvelope::class.java)

        assertEquals("77", envelope.jobId)
        assertEquals("GENERATE_STORY_COMPLETED", envelope.type)
        assertEquals("COMPLETED", envelope.status)
        assertEquals(10L, envelope.storyId)
    }

    // -----------------------------------------------------------------------
    // StoryboardImageResultEnvelope — GENERATE_STORYBOARD_IMAGE_COMPLETED
    // -----------------------------------------------------------------------

    @Test
    fun `GENERATE_STORYBOARD_IMAGE_COMPLETED envelope deserializes correctly`() {
        val json = """
        {
            "jobId": "88",
            "type": "GENERATE_STORYBOARD_IMAGE_COMPLETED",
            "storyId": 20,
            "pageNumber": 3,
            "status": "COMPLETED",
            "payload": {
                "seed": 12345,
                "result": {
                    "pageNumber": 3,
                    "imageUrl": "https://cdn.example.com/image3.jpg"
                }
            }
        }
        """.trimIndent()

        val envelope = objectMapper.readValue(json, StoryboardImageResultEnvelope::class.java)

        assertEquals("88", envelope.jobId)
        assertEquals(20L, envelope.storyId)
        assertEquals(3, envelope.pageNumber)
        assertNotNull(envelope.payload)
        assertEquals(12345, envelope.payload!!.seed)
        assertEquals("https://cdn.example.com/image3.jpg", envelope.payload.result.imageUrl)
    }

    // -----------------------------------------------------------------------
    // Unknown field tolerance — @JsonIgnoreProperties(ignoreUnknown=true)
    // -----------------------------------------------------------------------

    @Test
    fun `StorySummaryResultEnvelope ignores unknown fields without throwing`() {
        val json = """
        {
            "jobId": "99",
            "type": "GENERATE_STORY_SUMMARY_COMPLETED",
            "status": "FAILED",
            "unknownFieldAddedByAI": "some_future_value",
            "anotherNewField": 42,
            "error": {
                "code": "ERR",
                "message": "fail",
                "futureErrorField": true
            }
        }
        """.trimIndent()

        // Must NOT throw
        val envelope = objectMapper.readValue(json, StorySummaryResultEnvelope::class.java)

        assertEquals("99", envelope.jobId)
        assertEquals("FAILED", envelope.status)
        assertEquals("ERR", envelope.error!!.code)
    }

    @Test
    fun `null costUsd in usage is tolerated — optional field handling`() {
        val json = """
        {
            "jobId": "100",
            "type": "GENERATE_STORY_SUMMARY_COMPLETED",
            "status": "COMPLETED",
            "payload": {
                "title": "Title",
                "summary": "Summary",
                "summaryKo": "요약",
                "moralTheme": "hope",
                "storyQuest": "quest",
                "recurringMotif": "motif",
                "keyEmotionalBeats": ["calm"],
                "usage": {
                    "model": "gpt-4",
                    "promptTemplateVersion": "v1"
                }
            }
        }
        """.trimIndent()

        val envelope = objectMapper.readValue(json, StorySummaryResultEnvelope::class.java)

        assertNotNull(envelope.payload)
        assertNull(envelope.payload!!.usage.costUsd)
        assertNull(envelope.payload.usage.inputTokens)
    }

    @Test
    fun `all 4 summary envelope types parse without exception`() {
        val types = listOf(
            "GENERATE_STORY_SUMMARY_COMPLETED",
            "GENERATE_STORY_SUMMARY_FAILED",
            "REGENERATE_STORY_SUMMARY_COMPLETED",
            "REGENERATE_STORY_SUMMARY_FAILED",
        )

        for (type in types) {
            val isCompleted = type.endsWith("COMPLETED")
            val payloadSection = if (isCompleted) """
                "payload": {
                    "title": "T", "summary": "S", "summaryKo": "요",
                    "moralTheme": "m", "storyQuest": "q", "recurringMotif": "r",
                    "keyEmotionalBeats": ["calm"],
                    "usage": { "model": "gpt-4", "promptTemplateVersion": "v1" }
                }
            """.trimIndent() else """
                "error": { "code": "ERR", "message": "fail" }
            """.trimIndent()

            val status = if (isCompleted) "COMPLETED" else "FAILED"
            val json = """{"jobId":"1","type":"$type","status":"$status",$payloadSection}"""

            // Must not throw
            val envelope = objectMapper.readValue(json, StorySummaryResultEnvelope::class.java)
            assertEquals(type, envelope.type, "Type mismatch for $type")
        }
    }
}
