"""Persistence adapter for health measurements."""
from backend.extensions import db
from backend.models import HealthLog

class HealthLogRepository:
    def add(self, entry):
        return self.add_many([entry])[0]

    def add_many(self, entries):
        try:
            db.session.add_all(entries)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        return entries

    def list_for_user(self, user_id, metric_type=None, limit=None):
        query = HealthLog.query.filter_by(user_id=user_id)
        if metric_type:
            query = query.filter_by(metric_type=metric_type)
        query = query.order_by(HealthLog.timestamp.desc())
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def latest_for_user(self, user_id, metric_type, limit=2):
        return HealthLog.query.filter_by(user_id=user_id, metric_type=metric_type).order_by(HealthLog.timestamp.desc()).limit(limit).all()

    def get_for_user(self, log_id, user_id):
        return HealthLog.query.filter_by(id=log_id, user_id=user_id).first()

    def get(self, log_id):
        return HealthLog.query.get(log_id)

    def delete(self, entry):
        try:
            db.session.delete(entry)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
