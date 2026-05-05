from typing import Any

from app.consumers.tts_consumer import register_preview_tts_consumer
from app.mq.healthcheck import register_healthcheck_consumer
from app.worker_common import run_worker


# CI/CD health-check 전용 큐. RabbitMQ Mgmt API 로 이 큐의 consumer >= 1 을 검증해
# 워커 liveness 를 판정한다. 비즈니스 큐(ai.gpu.preview.request.queue) 와 의도적으로 분리.
# 이름은 infra/scripts/health-check-{dev,master}.sh 의 ai-tts-preview-worker 케이스와 동기화 필요.
HEALTHCHECK_QUEUE = "ai.healthcheck.tts-preview.queue"


def _register_consumers(channel: Any) -> None:
    register_preview_tts_consumer(channel)
    register_healthcheck_consumer(channel, HEALTHCHECK_QUEUE)


def main() -> None:
    run_worker("ai-tts-preview-worker", _register_consumers)


if __name__ == "__main__":
    main()
