# LLM RAG Pipeline Builder

## Overview

The LLM RAG Pipeline Builder is a visual tool that allows users to create and connect blocks to build a data processing pipeline. Each block can be linked to a Python function to perform specific tasks, enabling flexible and powerful data manipulation.

## Getting Started

### Requirements

- Python 3.x
- Flask
- Flask-CORS

### Installation

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install the Required Packages:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Flask Server:**
   ```bash
   python flask_backend.py
   ```

4. **Open the Application:**
   Open your web browser and navigate to `http://localhost:5000`.

## How It Works

- **Blocks**: The application uses draggable blocks that represent different data processing functions. These blocks can be connected to form a pipeline.
- **Connections**: You can connect blocks by dragging from an output node of one block to an input node of another. This connection represents the flow of data.
- **Execution**: Click the "Run Pipeline" button to execute all blocks in sequence, processing the data through the connected functions.

## Creating New Blocks with Custom Python Functions

### Step 1: Define the Python Function

Add your custom function to `main.py`. The function should take specific input types and return a specific output type.

Example:
```python
def custom_function(data: str) -> str:
    return data.upper()
```

### Step 2: Register the Function

Register the function using the `register_function` method in `main.py`.

Example:
```python
register_function('custom_function', custom_function, str, str)
```

### Step 3: Add Block Template in HTML

Open `static/index.html` and add a new block template in the sidebar section. This template should match the function's input and output structure.

Example:
```html
<div class="block-template" draggable="true" data-block-type="custom-function">
    <div class="block-drag-handle">Custom Function</div>
    <div class="block-content">
        <div class="input-group">
            <div class="input-node" data-input="Input"></div>
        </div>
        <div class="output-node" data-output="Output"></div>
    </div>
</div>
```

### Step 4: Update JavaScript Logic

Ensure that `static/app.js` can process the new block type. You may need to add logic to handle the execution of this block type if it's not already covered by your existing `processBlock` function.

Example:
```javascript
async function processBlock(block) {
    const type = block.getAttribute('data-block-type');
    switch (type) {
        case 'custom-function':
            const inputConnection = connections.find(conn => conn.target === block.id);
            if (inputConnection) {
                const sourceBlock = document.getElementById(inputConnection.source);
                const inputData = sourceBlock.dataset.output;
                const result = customFunction(inputData); // Call your custom function
                block.dataset.output = result;
                propagateData(block);
            }
            break;
        // other cases...
    }
}
```

## Features

- **Drag and Drop**: Easily drag and drop blocks to create your pipeline.
- **Custom Functions**: Extend the application with your own Python functions.
- **Visual Connections**: Clearly see the data flow between blocks with visual connections.

## Structure

- `flask_backend.py`: Flask server and API endpoints.
- `main.py`: Python functions that can be connected to blocks.
- `static/`: Frontend files.
  - `index.html`: Main HTML file.
  - `styles.css`: CSS styles.
  - `app.js`: Frontend JavaScript code.

