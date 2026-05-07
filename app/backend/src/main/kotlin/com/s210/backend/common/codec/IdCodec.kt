package com.s210.backend.common.codec

import org.slf4j.LoggerFactory
import org.sqids.Sqids
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * DB BIGINT id <-> 외부 노출용 alphanumeric 토큰 양방향 인코더.
 *
 * 정책:
 *  - alphabet/minLength 는 BE 만 보유한 비밀 (env: `app.id-codec.alphabet`, `app.id-codec.min-length`).
 *  - FE 는 토큰을 opaque 문자열로 다룬다 — 형식 검증/순서 추정 금지.
 *  - 외부에 노출되는 모든 도메인 id (storyId, sceneId, jobId 등) 는 이 코덱을 통해 토큰화된다.
 *  - BE 내부 (서비스 / 메시지 / DB) 에선 그대로 Long 사용 — 토큰화는 presentation 경계에서만 수행.
 *
 * [Phase 1 호환 모드]
 * `decode()` 는 토큰 문자열뿐 아니라 raw BIGINT 문자열도 허용한다.
 *  - 이미 외부에 공유된 raw-id URL 이 점진적 롤아웃 중에 깨지지 않도록 보호.
 *  - Phase 2 에서 strict 모드(token-only)로 좁힐 때 한 줄 제거로 전환 가능하게 분리.
 *
 * [디버그 로깅]
 * `app.id-codec.log-conversions=true` 일 때 모든 encode/decode 변환을 INFO 레벨로 로깅한다.
 *  - 운영에선 기본값 false — 토큰이 평문으로 로그에 남는 것을 방지.
 *  - 로컬/개발 환경 디버깅 시 명시적으로 켜서 확인.
 */
@Component
class IdCodec(
    @Value("\${app.id-codec.alphabet}") alphabet: String,
    @Value("\${app.id-codec.min-length:8}") minLength: Int,
    @Value("\${app.id-codec.log-conversions:false}") private val logConversions: Boolean,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val sqids: Sqids = Sqids.builder()
        .alphabet(alphabet)
        .minLength(minLength)
        .build()

    init {
        // 정적 핸들 — Jackson Serializer 같이 Spring DI 가 닿지 않는 곳에서 참조.
        instance = this
    }

    /** Long -> 토큰. Negative 는 정책상 미지원 (DB id 는 항상 양수). */
    fun encode(id: Long): String {
        require(id >= 0) { "id must be non-negative, got $id" }
        val token = sqids.encode(listOf(id))
        if (logConversions) log.info("[IdCodec] encode {} -> '{}'", id, token)
        return token
    }

    /**
     * 토큰 또는 raw BIGINT 문자열 -> Long.
     *
     *  - "12345" 처럼 숫자만 있으면 그대로 Long 으로 파싱 (Phase 1 호환).
     *  - 그 외엔 Sqids decode. 빈 결과면 IllegalArgumentException.
     */
    fun decode(token: String): Long {
        token.toLongOrNull()?.let {
            if (logConversions) log.info("[IdCodec] decode '{}' -> {} (raw)", token, it)
            return it
        }
        val decoded = sqids.decode(token)
        require(decoded.isNotEmpty()) { "Cannot decode id token: '$token'" }
        val id = decoded.first()
        if (logConversions) log.info("[IdCodec] decode '{}' -> {} (sqids)", token, id)
        return id
    }

    companion object {
        /**
         * IdCodec Spring bean 의 정적 참조.
         * Jackson serializer 처럼 Jackson 이 직접 인스턴스화하는 곳에서 사용.
         * `init {}` 블록에서 1 회 세팅된다 — 테스트 환경에서도 ApplicationContext 가 뜨면 자동 채워짐.
         */
        @Volatile
        lateinit var instance: IdCodec
            private set
    }
}
