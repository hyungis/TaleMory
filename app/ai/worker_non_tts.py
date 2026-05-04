from app.consumers.final_illustration_consumer import register_final_illustration_consumers
from app.consumers.storyboard_consumer import register_storyboard_consumers
from app.consumers.storyboard_image_consumer import register_storyboard_image_consumers
from app.worker_common import run_worker


def main() -> None:
    def register_non_tts_consumers(channel):
        register_storyboard_consumers(channel)
        register_storyboard_image_consumers(channel)
        register_final_illustration_consumers(channel)

    run_worker("ai-non-tts-worker", register_non_tts_consumers)


if __name__ == "__main__":
    main()
