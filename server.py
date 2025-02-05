from flask import Flask, request, jsonify
from flask_cors import CORS
from main import available_functions

app = Flask(__name__, static_folder='static')
CORS(app)

# Dictionary to store block connections and their associated functions
block_connections = {}

@app.route('/')
def serve_static():
    return app.send_static_file('index.html')

@app.route('/api/connect', methods=['POST'])
def connect_blocks():
    data = request.json
    source_id = data.get('source')
    target_id = data.get('target')
    input_id = data.get('inputId')
    
    # Store the connection
    connection_id = f"{source_id}-{target_id}-{input_id}"
    block_connections[connection_id] = {
        'source': source_id,
        'target': target_id,
        'inputId': input_id,
        'function': None  # Will be used to store associated Python function
    }
    
    return jsonify({'status': 'success', 'connection_id': connection_id})

@app.route('/api/connections', methods=['GET'])
def get_connections():
    return jsonify(block_connections)

if __name__ == '__main__':
    app.run(debug=True)
