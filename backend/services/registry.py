"""Application-scoped service container for the Flask modular monolith."""
from dataclasses import dataclass
from typing import List


@dataclass
class ServiceRegistry:
    diseases: List[dict]
    matcher: object
    chat_history: object
    notifications: object
    health_logs: object
    notification_records: object


def get_services(app):
    return app.extensions['medvitals']
