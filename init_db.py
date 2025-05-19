from flask import Flask
from models import db, User, AdminPanel
from extensions import init_app
from datetime import datetime
import os


def init_database():
    # Create a new Flask app instance
    app = Flask(__name__)

    # Configure the app
    app.config["SECRET_KEY"] = "dev-key-please-change"

    is_docker_env = os.environ.get("IS_DOCKER") == "true"
    project_root = os.path.dirname(os.path.abspath(__file__))

    if is_docker_env:
        # Docker environment: Use absolute path from container root
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:////app/instance/app.db"
        instance_folder_path = "/app/instance"
        print(f"RUNNING IN DOCKER: DB URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    else:
        # Local environment: DB will be in 'instance' subdir of project root
        instance_folder_path = os.path.join(project_root, "instance")
        db_abs_path = os.path.join(instance_folder_path, "app.db")
        # Use an absolute path for local execution, ensuring correct slashes for URI
        # To avoid f-string backslash issues, we construct the string carefully
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + db_abs_path.replace('\\\\', '/')
        print(f"RUNNING LOCALLY: DB URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
        print(f"Local instance folder target: {instance_folder_path}")

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    if not os.path.exists(instance_folder_path):
        os.makedirs(instance_folder_path)
        print(f"Created instance directory: {instance_folder_path}")
    else:
        print(f"Instance directory already exists: {instance_folder_path}")

    init_app(app)

    with app.app_context():
        db.drop_all()
        print("Existing tables dropped.")

        db.create_all()
        
        print(f"Database tables created/ensured for {app.config['SQLALCHEMY_DATABASE_URI']}.")

        # Verification for local execution
        if not is_docker_env:
            local_db_file_path = app.config["SQLALCHEMY_DATABASE_URI"].split("sqlite:///")[-1]
            if os.path.exists(local_db_file_path):
                print(f"Verified: Database file exists at {os.path.abspath(local_db_file_path)}")
            else:
                print(f"ERROR: Database file NOT found at {os.path.abspath(local_db_file_path)} after create_all.")
        else: # Verification for Docker (path is absolute in URI)
            docker_db_file_path = app.config["SQLALCHEMY_DATABASE_URI"].split("sqlite:///")[-1]
            if os.path.exists(docker_db_file_path):
                 print(f"Verified: Database file exists at {docker_db_file_path}")
            else:
                 print(f"ERROR: Database file NOT found at {docker_db_file_path} after create_all.")

        admin = User(
            username="admin",
            email="admin@example.com",
            is_admin=True,
            created_at=datetime.utcnow(),
        )
        admin.set_password("admin123")
        db.session.add(admin)

        settings = AdminPanel(
            maintenance_mode=False,
            maintenance_message="System is under maintenance. Please try again later.",
            max_login_attempts=5,
            password_reset_timeout=3600,
            public_mode=True
        )
        db.session.add(settings)
        db.session.commit()
        print("Database initialized successfully with default admin and settings.")

if __name__ == "__main__":
    init_database()
