# RAGgie: Retrieval Augmented Generation Pipeline Builder

<p align="center"><img src="static/images/icons/raggie-logo.png"></p>

RAGgie is a powerful, user-friendly web application for creating, testing, and exporting Retrieval Augmented Generation (RAG) pipelines. It provides a visual block-based interface where users can connect various LLM components to build custom RAG workflows without writing code.

## Overview

RAGgie simplifies the process of building Retrieval Augmented Generation (RAG) pipelines by providing a visual interface where users can:

1. Add blocks representing different LLM components (document loaders, text splitters, embeddings, etc.)
2. Connect these blocks to create a functional pipeline
3. Configure each block with custom parameters
4. Export the pipeline as a standalone Python script

The application is built with Flask on the backend and vanilla JavaScript on the frontend, making it lightweight and easy to deploy.

![image](https://github.com/user-attachments/assets/57daa554-9f21-4ef4-8e7a-d141f5e7ba0d)



## Features

- **Visual Block Editor**: Drag-and-drop interface for creating pipelines
- **Custom Block Creation**: Create reusable blocks from LangChain components
- **Live Testing**: Test your pipeline components directly in the browser
- **Python Export**: Export your pipeline as a Python script with all dependencies
- **Template System**: Save and load pipeline templates for quick reuse
- **Dark/Light Modes**: Switch between dark and light themes
- **Canvas Customization**: Change background colors and layout
- **Admin Panel**: Secure user management and system settings
- **Authentication**: User registration, login, and password reset functionality
- **Public/Private Mode**: Toggle between requiring login or allowing public access

## Architecture

```mermaid
graph TD
    A[Client Browser] -->|HTTP/AJAX| B[Flask Server]
    B -->|Response| A
    B -->|Database Operations| C[SQLite/SQL Database]
    B -->|Authentication| D[Auth Module]
    B -->|Admin Functions| E[Admin Module]
    B -->|Block Management| F[Block Module]
    F -->|Canvas Operations| G[Canvas Module]
    F -->|Code Generation| H[Generated Python Code]
    
    subgraph "Frontend Components"
        A1[Canvas Editor] --> A2[Block Templates]
        A1 --> A3[Connection Manager]
        A1 --> A4[Export Engine]
        A2 --> A5[Custom Block Creator]
    end
    
    subgraph "Backend Components"
        F1[Block Registry] --> F2[Pipeline Generator]
        F1 --> F3[LangChain Integration]
    end
    
    A -.-> A1
    F -.-> F1
```

## Prerequisites

- Python 3.11+
- pip (Python package manager)
- Git (optional, for cloning the repository)
- Docker (optional, for containerized deployment)

## Run in Docker

RAGgie can be easily used with Docker.
Just run `docker compose` to build and start the application:

```sh
docker compose up
# or, to run in detached mode
docker compose up -d
```

Configure the environment variables or volume mappings in the `compose.yml` file.
The used SQLite database (`app.db`) in the `instance/` directory can be persisted by mapping it to a Docker volume or a host directory, as shown in the `compose.yml`.

Once the container is running, access RAGgie at `http://localhost:5000` (or your custom IP address and port).

## Run Locally

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Configure Environment Variables

For both local development and production deployments, RAGgie uses environment variables for configuration. You can create a `.env` file in the root directory of the project to manage these settings. This file is loaded by some environments (like `python-dotenv` if you add it, or Docker Compose's `env_file` feature), but the application itself primarily expects these to be set in the shell environment or passed during Docker runtime.

**Key Environment Variables:**

*   `SECRET_KEY`: **Required.** A long, random string used for session security. **Change this for production.**
    *   Example: `SECRET_KEY=your-very-secret-and-random-string-here`
*   `DATABASE_URL`: **Optional.** The connection URI for the database.
    *   For local development (default): `sqlite:///instance/app.db` (The application will create this path relative to the project root).
    *   For Docker (default, set in Dockerfile): `sqlite:////app/instance/app.db` (This path is inside the container and should be mapped to a volume for persistence).
    *   For other databases (e.g., PostgreSQL): `postgresql://user:password@host:port/dbname`
*   `MAIL_SERVER`: **Optional.** SMTP server for email functionalities (e.g., password reset).
    *   Example: `MAIL_SERVER=smtp.gmail.com`
*   `MAIL_PORT`: **Optional.** SMTP server port.
    *   Example: `MAIL_PORT=587`
*   `MAIL_USE_TLS`: **Optional.** Whether to use TLS for email.
    *   Example: `MAIL_USE_TLS=True`
*   `MAIL_USERNAME`: **Optional.** Username for the SMTP server.
*   `MAIL_PASSWORD`: **Optional.** Password for the SMTP server (for Gmail, use an [App Password](https://support.google.com/accounts/answer/185833?hl=en) if 2FA is enabled).
*   `MAIL_DEFAULT_SENDER`: **Optional.** Default "from" address for emails.

**Example `.env` file content:**

```env
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///instance/app.db  # Or your preferred database URI
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
MAIL_DEFAULT_SENDER=your_email@gmail.com
```

> **Note:** For Gmail, you must use an [App Password](https://support.google.com/accounts/answer/185833?hl=en) if 2FA is enabled.

**Note:** `server.py` and `init_db.py` are coded to correctly determine the database path for local execution (creating `instance/app.db`). The `DATABASE_URL` in `.env` for local use primarily serves as an override or for clarity if you choose to use it. For Docker, the `DATABASE_URL` is set in the `Dockerfile` and can be overridden at runtime.

### Initialize the Database (for Local Setup)

```bash
python init_db.py
```

This creates the database and an initial admin user:

- **Username:** `admin`
- **Password:** `admin123`

> **Important:** When running the application locally (not using Docker), the `init_db.py` script (and the `server.py` application if the DB doesn't exist and `DATABASE_URL` isn't set to an external DB) will automatically create and use an SQLite database file (`app.db`) located in an `instance` subdirectory within your project folder (e.g., `pa1475_LLM/instance/app.db`). You **must** run `python init_db.py` at least once before starting the server if this database does not exist and you are not using an alternative `DATABASE_URL`.

### Data Persistence

- **Database (`instance/app.db`)**: The application, whether run directly or inside Docker, is coded to look for the SQLite database (`app.db`) in an `instance/` directory relative to the application root (e.g., `/app/instance/app.db` inside the container).
- **User Files (`files/`)**: The `files/` directory (used for uploads, etc.).

### Run the Application (for Local Setup)

```bash
python server.py
```

Visit [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## Getting Started

### First Login

1. Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000)
2. Log in with the default admin credentials:
   - Username: `admin`
   - Password: `admin123`
3. Change the default password immediately after login

### Creating Your First Pipeline

1. Navigate to the main canvas view
2. Click "Create Custom Block" in the sidebar
3. Search for a component (e.g., "PyPDFLoader")
4. Configure the block settings and add it to the canvas
5. Add more blocks and connect them by dragging from output nodes to input nodes
6. Test your pipeline by running individual blocks
7. Export your complete pipeline when finished

## Usage Guide

### Block Management

RAGgie's main interface is a canvas where you create and connect blocks:

1. **Adding Blocks**: Use the sidebar to create custom blocks from LangChain components
2. **Moving Blocks**: Drag blocks to reposition them on the canvas
3. **Connecting Blocks**: Click and drag from an output node to an input node
4. **Configuring Blocks**: Click a block to access its configuration panel
5. **Deleting Blocks**: Right-click a block and select "Delete" or press Delete key when selected

### Block Types and Components

RAGgie supports various LangChain components that can be added as blocks:

- **Document Loaders**: PyPDFLoader, DirectoryLoader, WebBaseLoader, etc.
- **Text Splitters**: RecursiveCharacterTextSplitter, TokenTextSplitter, etc.
- **Embeddings**: OpenAIEmbeddings, HuggingFaceEmbeddings, etc.
- **Vector Stores**: FAISS, Chroma, etc.
- **Retrievers**: Custom retrievers with various search strategies
- **Language Models**: ChatOpenAI, LLaMA, etc.
- **Chains**: Custom chains for question answering, summarization, etc.

### Canvas Navigation

- **Pan**: Hold spacebar or middle mouse button and drag
- **Zoom**: Use mouse wheel or pinch gestures
- **Fit to View**: Click the fit-to-view button to center all blocks in view
- **Mini-map**: Use the mini-map in the bottom-right corner for quick navigation

## Custom Block Creation

Creating custom blocks is at the heart of RAGgie:

1. Click "Create Custom Block" in the sidebar
2. Search for a LangChain component (e.g., "PyPDFLoader")
3. Review the component details and documentation
4. Select methods you want to include in your block
5. Configure default parameters
6. Add the block to your canvas

## Templates

Save your pipelines as templates for future use:

### Saving Templates

1. Create your pipeline on the canvas
2. Click the "Save Template" button in the Templates sidebar
3. Enter a name and description for your template
4. Click "Save"

### Loading Templates

1. Click the "Templates" button in the sidebar
2. Browse your saved templates
3. Click a template to load it to the canvas

## Exporting Pipelines

Convert your visual pipeline into a runnable Python script:

1. Build your complete pipeline on the canvas
2. Click the "Export Pipeline" button
3. Review the generated Python code
4. Download the code as a `.py` file
5. Run it with `python generated_pipeline.py` (ensure necessary libraries from your pipeline are installed in that environment)

The exported code includes:

- All necessary imports
- Component initialization with your configurations
- Connection logic between components
- Basic error handling and file operations

## Customization

### Theme Settings

RAGgie offers the following customization options:

1. **Theme Modes**:
   - Light Mode
   - Dark Mode
   - System (follows OS settings)

2. **Canvas Background**:
   - Default
   - White
   - Light Blue
   - Light Yellow
   - Light Green
   - Light Purple

### Advanced Configuration

For advanced users, RAGgie can be customized further:

- **CSS Styling**: Modify CSS files in the `/static/css` directory
- **New Components**: Update server.py to support additional LangChain components
- **Custom Templates**: Create predefined templates in the database

## Security and Authentication

RAGgie includes a full authentication system with the following features:

- **User Registration**: New users can register with email and password
- **Login System**: Secure login with session management
- **Password Reset**: Email-based password reset functionality
- **Role-based Access**: Admin and regular user roles
- **Public Mode**: Option to make the main site public (no login required)

> **Note**: Admin features are always protected regardless of public mode settings.

For a complete guide to the authentication and admin system, see [README-admin-auth.md](README-admin-auth.md).

## Deployment

This section provides guidance on deploying RAGgie to a production environment.

### General Recommendations

- **WSGI Server**: For production, do not use the Flask development server (`python server.py`). Instead, use a production-grade WSGI server like Gunicorn (which is included in `requirements.txt` and used in the `Dockerfile`) or uWSGI.
  Example with Gunicorn (if not using Docker):
  ```bash
  gunicorn -w 4 -b 0.0.0.0:5000 server:app
  ```
- **Environment Variables**: Ensure all required environment variables (especially `SECRET_KEY`, and `MAIL_*` if email is used) are properly set in your production environment. See [Step 3: Configure Environment Variables](#step-3-configure-environment-variables).
- **Database**: While SQLite is convenient for development, consider a more robust database like PostgreSQL or MySQL for larger-scale production deployments. Update the `DATABASE_URL` environment variable accordingly.
- **HTTPS**: Always serve the application over HTTPS in production. This is typically handled by a reverse proxy.


## Troubleshooting

### Common Issues

1. **Block Connections Not Working**:
   - Ensure the output and input types are compatible
   - Check that you're connecting to a valid input node

2. **Export Not Working**:
   - Verify all blocks are properly connected
   - Check for cycles in your pipeline

3. **Email Features Not Working**:
   - Verify your SMTP settings
   - For Gmail, ensure you're using an App Password

### Logs

Check for errors in the terminal where the server is running. For detailed logs:

```bash
python server.py > raggie.log 2>&1
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
