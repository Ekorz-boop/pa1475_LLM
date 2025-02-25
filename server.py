import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
from main import available_functions
import requests
import json
import os
import time
import sys
import subprocess
import platform
from blocks import (
    Block, ChatModelBlock, EmbeddingBlock, VectorStoreBlock,
    PDFLoaderBlock, TextSplitterBlock, RAGPromptBlock, Canvas
)

app = Flask(__name__, static_folder='static')
CORS(app)

# Global canvas instance
canvas = Canvas()

# Dictionary to store block connections and their associated functions
block_connections = {}

# Block type mapping
BLOCK_TYPES = {
    'chat_model': ChatModelBlock,
    'embedding': EmbeddingBlock,
    'vector_store': VectorStoreBlock,
    'pdf_loader': PDFLoaderBlock,
    'text_splitter': TextSplitterBlock,
    'rag_prompt': RAGPromptBlock
}

def is_ollama_running():
    try:
        response = requests.get("http://localhost:11434/api/version")
        return response.status_code == 200
    except:
        return False

def start_ollama():
    system = platform.system().lower()
    try:
        if system == "windows":
            # Check for Ollama installation
            possible_paths = [
                os.path.expandvars(r'%LOCALAPPDATA%\Ollama\ollama.exe'),
                r'C:\Program Files\Ollama\ollama.exe',
                os.path.expandvars(r'%ProgramFiles%\Ollama\ollama.exe')
            ]
            
            ollama_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    ollama_path = path
                    break
                    
            if ollama_path:
                try:
                    # First try normal start
                    subprocess.Popen([ollama_path, "serve"], 
                                   creationflags=subprocess.CREATE_NO_WINDOW)
                    time.sleep(2)
                    if is_ollama_running():
                        return {
                            'success': True,
                            'message': 'Ollama started successfully'
                        }
                    
                    # If normal start failed, try with admin rights
                    try:
                        subprocess.Popen(['runas', '/user:Administrator', ollama_path, 'serve'],
                                       creationflags=subprocess.CREATE_NO_WINDOW)
                        time.sleep(2)
                        if is_ollama_running():
                            return {
                                'success': True,
                                'message': 'Ollama started successfully with admin rights'
                            }
                    except:
                        return {
                            'success': False,
                            'message': 'Failed to start Ollama. Please start it manually from the Start menu'
                        }
                except Exception as e:
                    return {
                        'success': False,
                        'message': f'Found Ollama but failed to start it. Please start it manually: {str(e)}'
                    }
            else:
                return {
                    'success': False,
                    'message': 'Ollama not found. Please install it from https://ollama.ai/download',
                    'needsInstall': True
                }
                
        elif system in ["darwin", "linux"]:  # macOS and Linux
            try:
                # Try normal start first
                subprocess.Popen(["ollama", "serve"])
                time.sleep(2)
                if is_ollama_running():
                    return {
                        'success': True,
                        'message': 'Ollama started successfully'
                    }
                
                # If normal start failed, try with sudo
                try:
                    subprocess.Popen(['pkexec', 'ollama', 'serve'])  # Use pkexec for GUI sudo prompt
                    time.sleep(2)
                    if is_ollama_running():
                        return {
                            'success': True,
                            'message': 'Ollama started successfully with admin rights'
                        }
                except:
                    return {
                        'success': False,
                        'message': 'Failed to start Ollama. Please start it manually using: ollama serve'
                    }
            except FileNotFoundError:
                return {
                    'success': False,
                    'message': 'Ollama not found. Please install it first',
                    'needsInstall': True
                }
            except Exception as e:
                return {
                    'success': False,
                    'message': f'Failed to start Ollama. Please start it manually: {str(e)}'
                }
        
        return {
            'success': False,
            'message': 'Unsupported operating system'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Error starting Ollama: {str(e)}'
        }

def ensure_ollama_is_running():
    if not is_ollama_running():
        print("\nOllama is not running! The LLM features will not work until Ollama is started.")
        print("You can start Ollama from the web interface or manually:\n")
        if platform.system().lower() == "windows":
            print("   - Run the Ollama application from your Start menu")
        else:
            print("   - Open a terminal and run: ollama serve")

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
        'function': None
    }
    
    return jsonify({'status': 'success', 'connection_id': connection_id})

@app.route('/api/connections', methods=['GET'])
def get_connections():
    return jsonify(block_connections)

@app.route('/api/generate', methods=['POST'])
def generate_text():
    if not is_ollama_running():
        return jsonify({"error": "Ollama is not running. Please start Ollama and try again."}), 503
        
    data = request.json
    input_text = data.get('input', '')
    model_name = data.get('model', 'tinyllama')  # Default to tinyllama if no model specified
    
    # Ollama API endpoint
    url = "http://localhost:11434/api/generate"
    
    # Request payload for Ollama
    payload = {
        "model": model_name,
        "prompt": input_text,
        "stream": False
    }
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            result = response.json()
            return jsonify({"output": result.get('response', '')})
        else:
            return jsonify({"error": "Failed to generate response"}), 500
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Could not connect to Ollama. Please make sure Ollama is running."}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/system/status', methods=['GET'])
def get_system_status():
    ollama_running = is_ollama_running()
    return jsonify({
        'ollama_status': 'running' if ollama_running else 'not_running'
    })

@app.route('/api/system/install-ollama', methods=['POST'])
def install_ollama():
    system = platform.system().lower()
    try:
        if system == "windows":
            # Download Windows installer
            url = "https://ollama.ai/download/windows"
            return jsonify({
                'status': 'manual_install_required',
                'download_url': url
            })
        elif system == "darwin":
            subprocess.run(['brew', 'install', 'ollama'])
        elif system == "linux":
            # Add appropriate Linux installation commands
            subprocess.run(['curl', '-fsSL', 'https://ollama.ai/install.sh', '|', 'bash'])
        
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/system/start-ollama', methods=['POST'])
def start_ollama_endpoint():
    try:
        if is_ollama_running():
            return jsonify({'status': 'success', 'message': 'Ollama is already running'})
            
        result = start_ollama()
        if result['success']:
            # Wait for Ollama to be fully running
            for _ in range(5):  # Try for 10 seconds
                if is_ollama_running():
                    return jsonify({
                        'status': 'success',
                        'message': result['message']
                    })
                time.sleep(2)
            return jsonify({
                'status': 'error',
                'message': 'Started Ollama but service is not responding'
            }), 500
        else:
            # If Ollama isn't installed, provide download URL
            if 'not found' in result['message'].lower():
                return jsonify({
                    'status': 'error',
                    'message': result['message'],
                    'needsInstall': True,
                    'downloadUrl': 'https://ollama.ai/download'
                }), 404
            return jsonify({
                'status': 'error',
                'message': result['message']
            }), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/models/list', methods=['GET'])
def list_models():
    if not is_ollama_running():
        return jsonify({'error': 'Ollama is not running'}), 503
        
    try:
        response = requests.get('http://localhost:11434/api/tags')
        if response.status_code == 200:
            data = response.json()
            # Format the response to match what the frontend expects
            models = {
                'models': [
                    {
                        'name': model['name'],
                        'size': model.get('size', 0)
                    } for model in data['models']
                ]
            }
            return jsonify(models)
        return jsonify({'error': 'Failed to fetch models'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blocks/create', methods=['POST'])
def create_block():
    data = request.json
    block_type = data.get('type')
    block_id = data.get('id')
    
    if not block_type or not block_id:
        return jsonify({'error': 'Missing block type or ID'}), 400
    
    if block_type not in BLOCK_TYPES:
        return jsonify({'error': 'Invalid block type'}), 400
    
    try:
        block = BLOCK_TYPES[block_type]()
        canvas.add_block(block_id, block)
        return jsonify({'status': 'success', 'message': f'Created {block_type} block'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blocks/connect', methods=['POST'])
def connect_block_nodes():
    data = request.json
    source_id = data.get('source')
    target_id = data.get('target')
    
    if not source_id or not target_id:
        return jsonify({'error': 'Missing source or target ID'}), 400
    
    try:
        success = canvas.connect_blocks(source_id, target_id)
        if success:
            return jsonify({'status': 'success', 'message': 'Blocks connected successfully'})
        else:
            return jsonify({'error': 'Invalid connection'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blocks/export', methods=['POST'])
def export_blocks():
    data = request.json
    output_file = data.get('output_file', 'generated_rag.py')
    
    try:
        canvas.export_to_python(output_file)
        return jsonify({
            'status': 'success',
            'message': f'Successfully exported to {output_file}',
            'file': output_file
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blocks/list', methods=['GET'])
def list_blocks():
    try:
        blocks = {
            block_id: type(block).__name__
            for block_id, block in canvas.blocks.items()
        }
        return jsonify({
            'blocks': blocks,
            'connections': canvas.connections
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blocks/process', methods=['POST'])
def process_block():
    try:
        data = request.json
        block_id = data.get('block_id')
        block_type = data.get('type')
        config = data.get('config', {})
        
        print(f"\n[PROCESSING] Block: {block_type} (ID: {block_id})")
        print(f"[PROCESSING] Config: {config}")
        
        # Simple mock processing for now
        result = {
            'status': 'success',
            'output': f"Processed {block_type} with config {config}",
            'block_id': block_id
        }
        
        # Special handling for different block types
        if block_type == 'pdf_loader':
            files = config.get('files', [])
            result['output'] = f"Loaded {len(files)} PDF files"
            print(f"[PDF LOADER] Loaded {len(files)} files: {files}")
        elif block_type == 'text_splitter':
            chunk_size = config.get('chunk_size', 1000)
            overlap = config.get('chunk_overlap', 200)
            result['output'] = f"Split text into chunks (size: {chunk_size}, overlap: {overlap})"
            print(f"[TEXT SPLITTER] Chunk size: {chunk_size}, Overlap: {overlap}")
        elif block_type == 'embedding':
            model = config.get('model', 'default')
            result['output'] = f"Generated embeddings using {model} model"
            print(f"[EMBEDDING] Model: {model}")
        elif block_type == 'vector_store':
            top_k = config.get('top_k', 3)
            result['output'] = f"Stored vectors with top_k={top_k}"
            print(f"[VECTOR STORE] Top K: {top_k}")
        elif block_type == 'query_input':
            # Query input is processed on the frontend directly
            result['output'] = "Query received"
            print(f"[QUERY INPUT] Processing query")
        elif block_type == 'ai_model':
            model = config.get('model', 'default')
            temp = config.get('temperature', 0.75)
            result['output'] = f"Generated response using {model} with temperature {temp}"
            print(f"[AI MODEL] Model: {model}, Temperature: {temp}")
            # For AI model, add a dummy answer for testing display
            result['answer'] = f"This is a sample answer from the {model} model. It would respond to your query here."
        elif block_type == 'retrieval_ranking':
            method = config.get('ranking_method', 'similarity')
            result['output'] = f"Ranked retrieval results using {method}"
            print(f"[RETRIEVAL RANKING] Method: {method}")
        elif block_type == 'answer_display':
            result['output'] = "Display updated"
            print(f"[ANSWER DISPLAY] Updated display")
        
        print(f"[COMPLETED] Block: {block_type} ✓")
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] Block processing error: {str(e)}")
        return jsonify({'error': str(e), 'status': 'error'}), 500

if __name__ == '__main__':
    # Just print status instead of enforcing Ollama to run
    ensure_ollama_is_running()
    app.run(debug=True)
