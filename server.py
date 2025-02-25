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
        
        # Special handling for different block types
        if block_type == 'pdf_loader':
            files = config.get('files', [])
            try:
                from PyPDF2 import PdfReader
                content = []
                for file in files:
                    reader = PdfReader(file)
                    for page in reader.pages:
                        content.append(page.extract_text())
                
                full_content = "\n\n".join(content)
                result = {
                    'status': 'success',
                    'output': f"Loaded {len(files)} PDF files",
                    'content': full_content,
                    'block_id': block_id
                }
                print(f"[PDF LOADER] Loaded {len(files)} files: {files}")
                print(f"[PDF LOADER] Extracted {len(content)} pages of text")
            except Exception as e:
                result = {
                    'status': 'error',
                    'output': f"Error loading PDFs: {str(e)}",
                    'content': "",
                    'block_id': block_id
                }

        elif block_type == 'text_splitter':
            chunk_size = config.get('chunk_size', 1000)
            overlap = config.get('chunk_overlap', 200)
            
            # Get input from either content or input_text field
            input_text = config.get('content', '') or config.get('input_text', '')
            
            print(f"[TEXT SPLITTER] Input text length: {len(input_text)}")
            print(f"[TEXT SPLITTER] Chunk size: {chunk_size}, Overlap: {overlap}")
            
            if not input_text:
                result = {
                    'status': 'error',
                    'output': "No input text provided",
                    'chunks': [],
                    'block_id': block_id
                }
                print("[TEXT SPLITTER] Error: No input text provided")
                return result
            
            # Split text into chunks
            chunks = []
            words = input_text.split()
            current_chunk = []
            current_length = 0
            
            for word in words:
                word_length = len(word)
                
                # If adding this word would exceed chunk size, save current chunk
                if current_length + word_length + 1 > chunk_size and current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    chunks.append(chunk_text)
                    
                    # Keep overlap words for next chunk
                    if overlap > 0:
                        # Calculate how many words to keep based on overlap size
                        overlap_text = ' '.join(current_chunk[-overlap:])
                        current_chunk = current_chunk[-overlap:]
                        current_length = len(overlap_text)
                    else:
                        current_chunk = []
                        current_length = 0
                
                current_chunk.append(word)
                current_length += word_length + 1  # +1 for space
            
            # Add the last chunk if there's anything left
            if current_chunk:
                chunk_text = ' '.join(current_chunk)
                chunks.append(chunk_text)
            
            print(f"[TEXT SPLITTER] Generated {len(chunks)} chunks")
            for i, chunk in enumerate(chunks[:3]):  # Print first 3 chunks for debugging
                print(f"[TEXT SPLITTER] Chunk {i+1} preview: {chunk[:100]}...")
            
            result = {
                'status': 'success',
                'output': f"Split text into {len(chunks)} chunks",
                'chunks': chunks,
                'block_id': block_id
            }
            print(f"[TEXT SPLITTER] Success: Generated {len(chunks)} chunks")
            return result

        elif block_type == 'embedding':
            model = config.get('model', 'nomic-embed-text')
            # Try to get chunks from different possible config locations
            chunks = config.get('chunks', [])
            if not chunks and 'input_text' in config:
                chunks = [config['input_text']]
            
            print(f"[EMBEDDING] Config received: {config}")  # Debug print
            print(f"[EMBEDDING] Processing {len(chunks)} chunks with model: {model}")
            
            try:
                embeddings = []
                
                if not chunks:
                    raise ValueError("No chunks provided for embedding generation")
                
                for i, chunk in enumerate(chunks):
                    if not isinstance(chunk, str):
                        print(f"[EMBEDDING] Warning: Invalid chunk type at index {i}: {type(chunk)}")
                        continue
                        
                    if not chunk.strip():
                        print(f"[EMBEDDING] Warning: Empty chunk at index {i}")
                        continue
                    
                    print(f"[EMBEDDING] Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})")
                    print(f"[EMBEDDING] Chunk content preview: {chunk[:200]}...")  # Debug print
                    
                    response = requests.post('http://localhost:11434/api/embeddings', json={
                        'model': model,
                        'prompt': chunk
                    })
                    
                    if response.status_code == 200:
                        resp_data = response.json()
                        vector = resp_data.get('embedding', [])
                        
                        if not vector:
                            print(f"[EMBEDDING] Warning: Empty embedding vector for chunk {i+1}")
                            continue
                            
                        embeddings.append({
                            "text": chunk,
                            "embedding": vector
                        })
                        print(f"[EMBEDDING] Successfully embedded chunk {i+1} (vector size: {len(vector)})")
                    else:
                        print(f"[EMBEDDING] Error for chunk {i+1}: {response.text}")
                        raise Exception(f"Failed to get embedding: {response.text}")
                
                if not embeddings:
                    raise ValueError("No valid embeddings were generated")
                
                result = {
                    'status': 'success',
                    'output': f"Generated {len(embeddings)} embeddings using {model} model",
                    'embeddings': embeddings,
                    'block_id': block_id
                }
                print(f"[EMBEDDING] Final result: {result}")  # Debug print
                
            except Exception as e:
                error_msg = str(e)
                print(f"[EMBEDDING] Error: {error_msg}")
                result = {
                    'status': 'error',
                    'output': f"Error generating embeddings: {error_msg}",
                    'embeddings': [],
                    'block_id': block_id
                }

        elif block_type == 'vector_store':
            top_k = config.get('top_k', 3)
            chunks_embedded = config.get('chunks_embedded', [])
            query = config.get('query', '')
            
            try:
                from langchain_community.vectorstores import FAISS
                
                if not chunks_embedded or not query:
                    raise ValueError("Missing embedded chunks or query")
                
                # Extract texts and embeddings
                texts = [chunk['text'] for chunk in chunks_embedded]
                embeddings = [chunk['embedding'] for chunk in chunks_embedded]
                
                # Create FAISS index using Langchain with Ollama embeddings
                from langchain.embeddings import OllamaEmbeddings
                embeddings_model = OllamaEmbeddings(model="nomic-embed-text")
                vector_store = FAISS.from_embeddings(
                    text_embeddings=list(zip(texts, embeddings)), 
                    embedding=embeddings_model
                )
                
                # Get query embedding from Ollama
                response = requests.post('http://localhost:11434/api/embeddings', json={
                    'model': 'nomic-embed-text',
                    'prompt': query
                })
                if response.status_code != 200:
                    raise Exception(f"Failed to get query embedding: {response.text}")
                
                query_embedding = response.json().get('embedding', [])
                
                # Perform similarity search
                retrieved_docs = vector_store.similarity_search_by_vector(query_embedding, k=top_k)
                
                # Extract chunks and combine into context
                retrieved_chunks = [doc.page_content for doc in retrieved_docs]
                context = "\n\n".join(retrieved_chunks)
                
                result = {
                    'status': 'success',
                    'output': f"Retrieved top {top_k} documents for query: {query}",
                    'context': context,
                    'retrieved_chunks': retrieved_chunks,
                    'block_id': block_id
                }
                print(f"[VECTOR STORE] Retrieved {len(retrieved_chunks)} chunks for query: {query}")
                print(f"[VECTOR STORE] Context: {context}")
            except Exception as e:
                result = {
                    'status': 'error',
                    'output': f"Error in vector store: {str(e)}",
                    'context': "",
                    'block_id': block_id
                }
                print(f"[VECTOR STORE] Error: {str(e)}")

        elif block_type == 'query_input':
            query = config.get('query', '')
            # Get the query from the chat input if available
            chat_input = config.get('chat_input', '')
            if chat_input:
                query = chat_input
            
            if not query:
                result = {
                    'status': 'error',
                    'output': "No query provided",
                    'query': '',
                    'block_id': block_id
                }
                print(f"[QUERY INPUT] Error: No query provided")
            else:
                result = {
                    'status': 'success',
                    'output': "Query received",
                    'query': query,
                    'block_id': block_id
                }
                print(f"[QUERY INPUT] Query: {query}")

        elif block_type == 'ai_model':
            model = config.get('model', 'tinyllama')
            temp = config.get('temperature', 0.75)
            prompt = config.get('prompt', '')
            
            print(f"[AI MODEL] Model: {model}, Temperature: {temp}")
            print(f"[AI MODEL] Prompt template: {prompt}")
            
            # Call Ollama API for generation
            try:
                response = requests.post("http://localhost:11434/api/generate", json={
                    "model": model,
                    "prompt": prompt,
                    "temperature": temp,
                    "stream": False
                })
                
                if response.status_code == 200:
                    generated_text = response.json().get('response', '')
                    result = {
                        'status': 'success',
                        'output': f"Generated response using {model} with temperature {temp}",
                        'answer': generated_text,
                        'block_id': block_id
                    }
                    print(f"[AI MODEL] Generated answer: {generated_text}")
                else:
                    result = {
                        'status': 'error',
                        'output': f"Failed to generate response: {response.text}",
                        'answer': "Error: Failed to generate response",
                        'block_id': block_id
                    }
                    print(f"[AI MODEL] Error response: {response.text}")
            except Exception as e:
                result = {
                    'status': 'error',
                    'output': f"Error calling Ollama: {str(e)}",
                    'answer': f"Error: {str(e)}",
                    'block_id': block_id
                }
                print(f"[AI MODEL] Exception: {str(e)}")

        elif block_type == 'retrieval_ranking':
            method = config.get('ranking_method', 'similarity')
            chunks = config.get('chunks', [])
            query = config.get('query', '')
            
            try:
                from sentence_transformers import CrossEncoder
                
                # Use cross-encoder for more accurate relevance scoring
                model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
                
                # Score each chunk
                pairs = [[query, chunk] for chunk in chunks]
                scores = model.predict(pairs)
                
                # Sort chunks by score
                ranked_pairs = list(zip(chunks, scores))
                ranked_pairs.sort(key=lambda x: x[1], reverse=True)
                
                ranked_chunks = [pair[0] for pair in ranked_pairs]
                context = "\n\n".join(ranked_chunks)
                
                result = {
                    'status': 'success',
                    'output': f"Ranked retrieval results using {method}",
                    'ranked_chunks': ranked_chunks,
                    'context': context,
                    'scores': scores.tolist(),
                    'block_id': block_id
                }
                print(f"[RETRIEVAL RANKING] Ranked {len(ranked_chunks)} chunks")
                for i, (chunk, score) in enumerate(ranked_pairs):
                    print(f"[RETRIEVAL RANKING] Rank {i+1} (score: {score:.3f}): {chunk[:100]}...")
            except Exception as e:
                result = {
                    'status': 'error',
                    'output': f"Error in ranking: {str(e)}",
                    'ranked_chunks': chunks,
                    'context': "\n\n".join(chunks),
                    'block_id': block_id
                }
                print(f"[RETRIEVAL RANKING] Error: {str(e)}")

        elif block_type == 'answer_display':
            result = {
                'status': 'success',
                'output': "Display updated",
                'block_id': block_id
            }
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
