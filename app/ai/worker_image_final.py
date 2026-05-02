from app.consumers.final_illustration_consumer import register_final_illustration_consumers
from app.worker_common import run_worker


def main() -> None:
    run_worker("ai-final-image-worker", register_final_illustration_consumers)


if __name__ == "__main__":
    main()
