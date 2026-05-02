from app.consumers.storyboard_image_consumer import register_storyboard_image_consumers
from worker_common import run_worker


def main() -> None:
    run_worker("ai-storyboard-image-worker", register_storyboard_image_consumers)


if __name__ == "__main__":
    main()
