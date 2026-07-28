import os
import random
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.extensions import db, scheduler
from backend.models import Notification, User

class NotificationManager:
    def __init__(self):
        self.email_enabled = os.getenv('EMAIL_ENABLED', 'False').lower() == 'true'
        self.email_settings = {
            'smtp_server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
            'smtp_port': int(os.getenv('SMTP_PORT', '587')),
            'username': os.getenv('EMAIL_USERNAME', ''),
            'password': os.getenv('EMAIL_PASSWORD', ''),
            'from_email': os.getenv('FROM_EMAIL', 'noreply@healthcarebot.com')
        }
    
    def send_email(self, to_email, subject, body):
        if not self.email_enabled:
            return {'status': 'disabled'}
        
        try:
            msg = MIMEMultipart()
            msg['From'] = self.email_settings['from_email']
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(self.email_settings['smtp_server'], self.email_settings['smtp_port'])
            server.starttls()
            server.login(self.email_settings['username'], self.email_settings['password'])
            server.send_message(msg)
            server.quit()
            
            return {'status': 'success'}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    
    def schedule_notification(self, user_id, notif_type, title, message, scheduled_time, method='email'):
        notification = Notification(
            user_id=user_id,
            type=method,
            title=title,
            message=message,
            scheduled_time=scheduled_time,
            status='pending'
        )
        db.session.add(notification)
        db.session.commit()
        
        scheduler.add_job(
            self._send_scheduled,
            trigger='date',
            run_date=scheduled_time,
            args=[notification.id],
            id=f"notif_{notification.id}",
            replace_existing=True
        )
        
        return notification
    
    def _send_scheduled(self, notification_id):
        # We need app context to access SQLAlchemy queries in background threads
        from flask import current_app
        with current_app.app_context():
            notification = Notification.query.get(notification_id)
            if not notification or notification.status != 'pending':
                return
            
            user = User.query.get(notification.user_id)
            if not user or not user.notifications_enabled:
                notification.status = 'skipped'
                db.session.commit()
                return
            
            result = None
            if notification.type == 'email':
                result = self.send_email(user.email, notification.title, notification.message)
            
            notification.sent_time = datetime.utcnow()
            notification.status = 'sent' if result and result['status'] == 'success' else 'failed'
            db.session.commit()
    
    def create_medication_reminder(self, user_id, med_name, dosage, schedule_times, duration_days):
        reminders = []
        now = datetime.utcnow()
        
        for day in range(duration_days):
            for time_str in schedule_times:
                try:
                    hour, minute = map(int, time_str.split(':'))
                    scheduled = datetime(
                        year=now.year,
                        month=now.month,
                        day=now.day,
                        hour=hour,
                        minute=minute,
                        second=0
                    ) + timedelta(days=day)
                    
                    # If this time has already passed today, push to the next day
                    if scheduled <= now:
                        scheduled += timedelta(days=1)
                    
                    reminder = self.schedule_notification(
                        user_id=user_id,
                        notif_type='medication',
                        title=f'Medication Reminder: {med_name}',
                        message=f'Time to take {med_name} - {dosage}',
                        scheduled_time=scheduled,
                        method='email'
                    )
                    reminders.append(reminder)
                except Exception as e:
                    print(f"Error scheduling medication reminder: {e}")
        
        return reminders
    
    def create_appointment_reminder(self, user_id, doctor_name, appointment_time, location, notes=''):
        reminder_24h = appointment_time - timedelta(hours=24)
        if reminder_24h > datetime.utcnow():
            self.schedule_notification(
                user_id=user_id,
                notif_type='appointment',
                title=f'Appointment Reminder: Dr. {doctor_name}',
                message=f'Appointment tomorrow at {appointment_time.strftime("%I:%M %p")}\nLocation: {location}\n{notes}',
                scheduled_time=reminder_24h,
                method='email'
            )
        
        reminder_1h = appointment_time - timedelta(hours=1)
        if reminder_1h > datetime.utcnow():
            self.schedule_notification(
                user_id=user_id,
                notif_type='appointment',
                title=f'Appointment in 1 Hour: Dr. {doctor_name}',
                message=f'Appointment at {appointment_time.strftime("%I:%M %p")}\nLocation: {location}',
                scheduled_time=reminder_1h,
                method='email'
            )
    
    def send_health_tip(self, user_id, category='general'):
        tips = {
            'general': [
                "Drink 8 glasses of water daily",
                "Get 7-8 hours of sleep",
                "Exercise 30 minutes daily",
                "Wash hands frequently",
                "Take screen breaks every hour"
            ],
            'seasonal': [
                "Get your flu shot",
                "Stay hydrated in summer",
                "Use sunscreen daily",
                "Wear mask during flu season"
            ],
            'chronic': [
                "Monitor blood pressure regularly",
                "Take medications on time",
                "Keep a symptoms diary",
                "Attend follow-up appointments"
            ]
        }
        
        tip = random.choice(tips.get(category, tips['general']))
        
        return self.schedule_notification(
            user_id=user_id,
            notif_type='health_tip',
            title='Daily Health Tip',
            message=tip,
            scheduled_time=datetime.utcnow() + timedelta(hours=9),
            method='email'
        )
