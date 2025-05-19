# RAGgie: Retrieval Augmented Generation Pipeline Builder

![RAGgie Logo](static/images/icons/raggie-logo.png)

RAGgie is a powerful, user-friendly web application for creating, testing, and exporting Retrieval Augmented Generation (RAG) pipelines. It provides a visual block-based interface where users can connect various LLM components to build custom RAG workflows without writing code.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Custom Block Creation](#custom-block-creation)
- [Templates](#templates)
- [Exporting Pipelines](#exporting-pipelines)
- [Customization](#customization)
- [Security and Authentication](#security-and-authentication)
- [Deployment](#deployment)
- [Docker](#docker)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

RAGgie simplifies the process of building Retrieval Augmented Generation (RAG) pipelines by providing a visual interface where users can:

1. Add blocks representing different LLM components (document loaders, text splitters, embeddings, etc.)
2. Connect these blocks to create a functional pipeline
3. Configure each block with custom parameters
4. Export the pipeline as a standalone Python script

The application is built with Flask on the backend and vanilla JavaScript on the frontend, making it lightweight and easy to deploy.

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

## Installation

### Prerequisites

- Python 3.11+ 
- pip (Python package manager)
- Git (optional, for cloning the repository)
- Docker (optional, for containerized deployment)

### Step 1: Clone the Repository

```bash
git clone https://github.com/Ekorz-boop/pa1475_LLM.git
cd pa1475_LLM
```

Or download and extract the ZIP file from the repository.

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables

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

### Step 4: Initialize the Database (for Local Setup)

```bash
python init_db.py
```

This creates the database and an initial admin user:
- **Username:** `admin`
- **Password:** `admin123`

> **Important:** When running the application locally (not using Docker), the `init_db.py` script (and the `server.py` application if the DB doesn't exist and `DATABASE_URL` isn't set to an external DB) will automatically create and use an SQLite database file (`app.db`) located in an `instance` subdirectory within your project folder (e.g., `pa1475_LLM/instance/app.db`). You **must** run `python init_db.py` at least once before starting the server if this database does not exist and you are not using an alternative `DATABASE_URL`.

### Data Persistence

-   **Database (`instance/app.db`)**: The application, whether run directly or inside Docker, is coded to look for the SQLite database (`app.db`) in an `instance/` directory relative to the application root (e.g., `/app/instance/app.db` inside the container). 
    -   When running Docker, the `init_db.py` script (executed by the Docker `CMD`) will create this `instance/app.db` file within the container if it doesn't exist. 
    -   To persist your database across container restarts, you **must** use a Docker volume to map a directory on your host to the `/app/instance` directory inside the container. This ensures that the `app.db` file created or used by the application is stored on your host machine and survives container recreation.
    ```bash
    docker volume create raggie-data
    docker run -d \\
      -p 5000:5000 \\
      --name raggie-container \\
      -v raggie-data:/app/instance \\
      # Add your -e environment variables here
      raggie-app
    ```
    When using a volume for the first time, `init_db.py` will create the `app.db` in the volume. Subsequent runs will use the existing `app.db` from the volume. You might want to adjust `init_db.py` or the `Dockerfile` `CMD` if you have specific needs for managing an existing database in a volume.

-   **User Files (`files/`)**: The `files/` directory (used for uploads, etc.) is part of the container. If you need data in this directory to persist or be shared, consider mounting a volume for it as well:

### Step 5: Run the Application (for Local Setup)

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

### Docker Deployment

RAGgie includes a `Dockerfile` for easy containerization and deployment.

**1. Build the Docker Image:**

Navigate to the project root directory (where the `Dockerfile` is located) and run:

```bash
docker build -t raggie-app .
```

**2. Run the Docker Container:**

To run the container:

```bash
docker run -d \
  -p 5000:5000 \
  --name raggie-container \
  -e SECRET_KEY="your_production_secret_key_here" \
  # Add other -e flags for MAIL_SERVER, MAIL_PORT, etc. as needed
  # Example for a custom database URL (if not using the default SQLite in a volume):
  # -e DATABASE_URL="postgresql://user:password@host:port/dbname" \
  raggie-app
```

**Environment Variables in Docker:**

- The `Dockerfile` sets some default environment variables (like `DATABASE_URL=sqlite:////app/instance/app.db`).
- **Crucially, override `SECRET_KEY` at runtime using the `-e` flag.**
- Pass any other necessary environment variables (e.g., `MAIL_*` settings) using `-e` flags.
- Alternatively, you can use a `.env` file with `docker run --env-file ./my.env ...` or with Docker Compose.

**3. Data Persistence with Docker Volumes:**

To ensure your data persists across container restarts, use Docker volumes.

-   **Database (`/app/instance/app.db` inside the container):**
    The `Dockerfile`'s `CMD` includes `python init_db.py`, which will create `instance/app.db` inside the container if it doesn't exist. To persist this database:
    ```bash
    docker volume create raggie-db-data
    docker run -d \
      -p 5000:5000 \
      --name raggie-container \
      -v raggie-db-data:/app/instance \
      -e SECRET_KEY="your_production_secret_key_here" \
      # Add other -e flags as needed
      raggie-app
    ```
    The first time you run with a new volume, `init_db.py` will create the database. For subsequent runs, it will use the existing database.

-   **User Files (`/app/files/` inside the container):**
    If your application uses the `files/` directory for user uploads or other persistent file storage, you should also mount a volume for it:
    ```bash
    docker volume create raggie-user-files
    docker run -d \
      -p 5000:5000 \
      --name raggie-container \
      -v raggie-db-data:/app/instance \
      -v raggie-user-files:/app/files \
      -e SECRET_KEY="your_production_secret_key_here" \
      # Add other -e flags as needed
      raggie-app
    ```
    When using a volume for the first time, the `init_db.py` script in the `CMD` will create the database. For subsequent runs, it will use the existing database in the volume. You might want to adjust `init_db.py` or the `Dockerfile` `CMD` if you have specific needs for managing an existing database in a volume.

**4. Accessing the Application:**

Once the container is running, access RAGgie at `http://localhost:5000` (or your server's IP address).

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

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b new-feature`
3. Make your changes
4. Run tests (if available)
5. Commit your changes: `git commit -m 'Add new feature'`
6. Push to the branch: `git push origin new-feature`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
