from flask import Flask
from models import db, User, AdminPanel
from extensions import init_app
from datetime import datetime

def init_database():
    # Create a new Flask app instance
    app = Flask(__name__)
    
    # Configure the app
    app.config["SECRET_KEY"] = "dev-key-please-change"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    # Initialize the app
    init_app(app)
    
    with app.app_context():
        # Drop all tables
        db.drop_all()
        print("Existing tables dropped.")
        
        # Create all tables
        db.create_all()
        
        # Create admin user if it doesn't exist
        admin = User(
            username="admin",
            email="admin@example.com",
            is_admin=True,
            created_at=datetime.utcnow()
        )
        admin.set_password("admin123")
        
        # Add admin user to database
        db.session.add(admin)
        
        # Create default admin settings
        settings = AdminPanel(
            maintenance_mode=False,
            maintenance_message="System is under maintenance. Please try again later.",
            max_login_attempts=5,
            password_reset_timeout=3600
        )
        db.session.add(settings)
        
        # Commit changes
        db.session.commit()
        
        print("Database initialized successfully!")

if __name__ == "__main__":
    init_database() 