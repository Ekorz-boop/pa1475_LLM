# Block Connector Web App

A simple web application that allows users to drag and drop blocks and connect them. The connections can be associated with Python functions.

## Setup

1. Install the required Python packages:
```bash
pip install -r requirements.txt
```

2. Run the Flask application:
```bash
python flask_backend.py
```

3. Open your web browser and navigate to:
```
http://localhost:5000
```

## Usage

1. Drag the blocks to position them on the canvas
2. Click on one block and then another to create a connection between them
3. The connections are stored in the backend and can be associated with Python functions

## Features

- Drag and drop blocks
- Create connections between blocks by clicking
- Backend storage of connections
- Extensible Python function framework
- Visual connection lines between blocks

## Structure

- `flask_backend.py`: Flask server and API endpoints
- `building_blocks.py`: Python functions that can be connected to blocks
- `static/`: Frontend files
  - `index.html`: Main HTML file
  - `styles.css`: CSS styles
  - `app.js`: Frontend JavaScript code
