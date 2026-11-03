-- Optional performance indexes for existing SQLite deployments.
-- Review a backup and apply this migration explicitly; the app does not run it.
CREATE INDEX IF NOT EXISTS ix_chat_session_user_start
    ON chat_session (user_id, start_time);
CREATE INDEX IF NOT EXISTS ix_chat_message_session_time
    ON chat_message (session_id, timestamp);
CREATE INDEX IF NOT EXISTS ix_disease_search_time_top_match
    ON disease_search (search_time, top_match);
CREATE INDEX IF NOT EXISTS ix_health_log_user_metric_time
    ON health_log (user_id, metric_type, timestamp);
CREATE INDEX IF NOT EXISTS ix_notification_user_status_schedule
    ON notification (user_id, status, scheduled_time);
