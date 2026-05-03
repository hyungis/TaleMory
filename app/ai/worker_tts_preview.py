from app.consumers.tts_consumer import register_preview_tts_consumer
from app.worker_common import run_worker


def main() -> None:
    run_worker("ai-tts-preview-worker", register_preview_tts_consumer)


if __name__ == "__main__":
    main()
