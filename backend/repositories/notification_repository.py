"""Persistence adapter for user notifications and reminders."""
from datetime import datetime

from backend.extensions import db
from backend.models import Notification, User


class NotificationRepository:
    def list_for_user(self, user_id, status=None, limit=None, ascending=False):
        query = Notification.query.filter_by(user_id=user_id)
        if status:
            query = query.filter_by(status=status)
        order = Notification.scheduled_time.asc() if ascending else Notification.scheduled_time.desc()
        query = query.order_by(order)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def get(self, notification_id):
        return Notification.query.get(notification_id)

    def get_user(self, user_id):
        return User.query.get(user_id)

    def list_due(self, user_id, now=None):
        now = now or datetime.utcnow()
        return Notification.query.filter(
            Notification.user_id == user_id,
            Notification.status == 'pending',
            Notification.scheduled_time <= now,
        ).order_by(Notification.scheduled_time.asc()).all()

    def list_pending(self):
        return Notification.query.filter_by(status='pending').all()

    def add_many(self, notifications):
        try:
            db.session.add_all(notifications)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        return notifications

    def save(self):
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
