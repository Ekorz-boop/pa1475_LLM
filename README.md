# RAGgie - RAG Pipeline Builder

A web-based tool for creating, testing, and exporting RAG (Retrieval-Augmented Generation) pipelines.

## Features

- User authentication system
- Visual pipeline builder
- Custom block creation
- Pipeline export to Python code
- Debug mode for testing
- Dark mode support
- Responsive design

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd raggie
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
# Create a .env file with the following variables:
SECRET_KEY=your-secret-key
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-email-password
```

5. Initialize the database:
```bash
flask db init
flask db migrate
flask db upgrade
```

6. Run the application:
```bash
python server.py
```

The application will be available at `http://localhost:5000`

## Usage

1. Register a new account or log in with existing credentials
2. Use the sidebar to access blocks and templates
3. Drag and drop blocks onto the canvas
4. Connect blocks to create your pipeline
5. Use the export button to generate Python code
6. Use the run button to test your pipeline

## Development

- The application uses Flask for the backend
- SQLite database for user management
- Flask-Login for authentication
- Flask-Mail for password reset functionality
- Custom CSS for styling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.