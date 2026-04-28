from app.consumers.final_illustration_consumer import register_final_illustration_consumers
from app.consumers.storyboard_consumer import register_storyboard_consumers
from app.consumers.storyboard_image_consumer import register_storyboard_image_consumers
from app.mq.client import create_channel, create_connection, declare_storyboard_topology


if __name__ == "__main__":
    connection = create_connection()
    channel = create_channel(connection)
    declare_storyboard_topology(channel)
    register_storyboard_consumers(channel)
    register_storyboard_image_consumers(channel)
    register_final_illustration_consumers(channel)
    try:
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()
