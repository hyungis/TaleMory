package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.BaseTimeEntity
import jakarta.persistence.*

@Entity
@Table(name = "scene_sentences")
class SceneSentence(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "scene_id", nullable = false)
    val sceneId: Long,

    @Column(name = "sentence_order", nullable = false)
    val sentenceOrder: Int,

    @Column(name = "english_text", nullable = false, columnDefinition = "TEXT")
    var englishText: String,

    @Column(name = "korean_text", columnDefinition = "TEXT")
    var koreanText: String? = null,

    @Column(name = "tts_audio_url", length = 500)
    var ttsAudioUrl: String? = null,

    @Column(name = "speaker_key", length = 50)
    var speakerKey: String? = null,

    /**
     * WEBTOON 모드 한정. 말풍선/캡션 anchor 좌표를 담는 raw JSON `{"x": 0~1, "y": 0~1}`.
     *
     * - NARRATION 문장: 백엔드가 `AnchorPoint.NARRATION_DEFAULT` (0.5, 0.05) 직렬화해 주입.
     * - DIALOGUE 문장: WebtoonLayoutResultListener 가 AI Vision 결과의 캐릭터 anchor 를 매핑.
     * - VIEWER 모드 row 는 항상 null.
     *
     * 애플리케이션 레이어에서 ObjectMapper 로 [com.s210.backend.domain.story.model.AnchorPoint] 와
     * 상호 변환 (Scene.characterAnchors 와 동일 패턴).
     */
    @Column(name = "bubble_slot", columnDefinition = "JSON")
    var bubbleSlot: String? = null,

    @Column(name = "has_highlighted", nullable = false)
    var hasHighlighted: Boolean = false
) : BaseTimeEntity()
