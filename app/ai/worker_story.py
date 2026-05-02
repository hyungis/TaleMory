from app.consumers.storyboard_consumer import register_storyboard_consumers
from app.worker_common import run_worker


def main() -> None:
    run_worker("ai-story-worker", register_storyboard_consumers)


if __name__ == "__main__":
    main()
