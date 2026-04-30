package com.s210.backend.domain.tts.application.contract

import com.s210.backend.domain.tts.application.dto.StoryTtsJobMessage
import com.s210.backend.domain.tts.application.dto.StoryTtsResultEnvelope
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import tools.jackson.module.kotlin.jacksonObjectMapper

class StoryTtsJsonContractTest {
    private val mapper = jacksonObjectMapper()

    @Test
    fun `job message round-trip preserves all fields`() {
        val json = readFixture("contracts/tts/job-message.json")
        val msg = mapper.readValue(json, StoryTtsJobMessage::class.java)
        assertThat(msg.jobId).isEqualTo("12345")
        assertThat(msg.payload.storyId).isEqualTo(100)
        assertThat(msg.payload.voiceId).isEqualTo("42")
        assertThat(msg.payload.referenceAudioUrl).startsWith("https://s3")
        assertThat(msg.payload.sentences).hasSize(2)
        assertThat(msg.payload.sentences[0].sentenceId).isEqualTo(1001L)
    }

    @Test
    fun `result completed envelope deserializes`() {
        val json = readFixture("contracts/tts/result-completed.json")
        val env = mapper.readValue(json, StoryTtsResultEnvelope::class.java)
        assertThat(env.type).isEqualTo("GENERATE_TTS_COMPLETED")
        assertThat(env.payload).isNotNull
        assertThat(env.payload!!.items).hasSize(1)
        assertThat(env.payload!!.items[0].audio?.audioUrl).isEqualTo("https://s3/a.wav")
        assertThat(env.payload!!.sceneSentenceUpdates).hasSize(1)
    }

    @Test
    fun `result failed envelope deserializes`() {
        val json = readFixture("contracts/tts/result-failed.json")
        val env = mapper.readValue(json, StoryTtsResultEnvelope::class.java)
        assertThat(env.type).isEqualTo("GENERATE_TTS_FAILED")
        assertThat(env.payload).isNull()
        assertThat(env.error?.code).isEqualTo("AI_PROVIDER_ERROR")
    }

    private fun readFixture(path: String): String =
        this::class.java.classLoader.getResourceAsStream(path)!!
            .bufferedReader().use { it.readText() }
}
