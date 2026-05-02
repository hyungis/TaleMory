from app.consumers.final_illustration_consumer import register_final_illustration_consumers
from app.consumers.storyboard_consumer import register_storyboard_consumers
from app.consumers.storyboard_image_consumer import register_storyboard_image_consumers
from app.consumers.tts_consumer import register_tts_consumers
from worker_common import run_worker


def main() -> None:
    def register_all_consumers(channel):
        register_storyboard_consumers(channel)
        register_storyboard_image_consumers(channel)
        register_final_illustration_consumers(channel)
        register_tts_consumers(channel)

    run_worker("ai-worker", register_all_consumers)


if __name__ == "__main__":
    main()
