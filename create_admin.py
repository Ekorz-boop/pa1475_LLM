from flask import Flask
from models import User, db
from extensions import init_app

def create_admin_user(username, email, password):
    # Create a new Flask app instance
    app = Flask(__name__)
    
    # Configure the app
    app.config['SECRET_KEY'] = 'dev-key-please-change'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize the app
    init_app(app)
    
    with app.app_context():
        # Create admin user
        admin = User(
            username=username,
            email=email,
            is_admin=True
        )
        admin.set_password(password)
        
        # Add to database
        db.session.add(admin)
        db.session.commit()
        
        print(f"Admin user '{username}' created successfully!")

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 4:
        print("Usage: python create_admin.py <username> <email> <password>")
        sys.exit(1)
    
    username = sys.argv[1]
    email = sys.argv[2]
    password = sys.argv[3]
    
    create_admin_user(username, email, password) 