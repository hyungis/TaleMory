"""
워커 health-check 전용 no-op consumer.

CI/CD 의 health-check 단계에서 RabbitMQ Management API 로 "워커가 broker 측에 정상
register 됐는가" 만 확인하기 위한 별도 큐. 비즈니스 큐 / env var 와 분리되어 있어
운영 중 비즈니스 큐 이름 변경 / GitLab Variable 변경에 영향받지 않는다.

이 큐엔 publish 가 일어나지 않으므로 _no_op 콜백은 실제로 호출되지 않는다 (시그니처 충족용).

사용 예 (worker_tts_story.py):
    HEALTHCHECK_QUEUE = "ai.healthcheck.tts-story.queue"

    def _register_consumers(channel):
        register_story_tts_consumer(channel)
        register_healthcheck_consumer(channel, HEALTHCHECK_QUEUE)

큐 이름은 워커 모듈의 HEALTHCHECK_QUEUE 상수에서 관리하고, infra/scripts/health-check-*.sh 의
해당 워커 케이스와 동기화한다 — 양쪽 다 코드 하드코딩이므로 env var 추가 의무 없음.
"""
from typing import Any


def register_healthcheck_consumer(channel: Any, queue_name: str) -> None:
    """워커 liveness 신호용 큐를 declare 하고 no-op consumer 등록.

    durable=True 로 broker 재시작에 살아남게 하고, 이 큐는 어떤 exchange 에도 bind 하지 않아
    외부에서 메시지가 라우팅되지 않는다 (격리된 health-check 슬롯).
    """
    channel.queue_declare(queue=queue_name, durable=True)
    channel.basic_consume(
        queue=queue_name,
        on_message_callback=_no_op,
        auto_ack=True,
    )


def _no_op(channel: Any, method: Any, properties: Any, body: bytes) -> None:
    """이 큐엔 publish 가 없으므로 실제 호출되지 않음 — 시그니처만 충족."""
    return
