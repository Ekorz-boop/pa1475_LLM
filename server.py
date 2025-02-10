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

app = Flask(__name__, static_folder='static')
CORS(app)

# Dictionary to store block connections and their associated functions
block_connections = {}

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
    
    # Ollama API endpoint
    url = "http://localhost:11434/api/generate"
    
    # Request payload for Ollama
    payload = {
        "model": "tinyllama",
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

if __name__ == '__main__':
    # Just print status instead of enforcing Ollama to run
    ensure_ollama_is_running()
    app.run(debug=True)
