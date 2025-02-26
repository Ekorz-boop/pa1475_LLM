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
import random
from langchain.docstore.document import Document
from langchain_community.vectorstores import FAISS
import numpy as np
import faiss
from langchain_community.docstore.in_memory import InMemoryDocstore

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
        debug_mode = data.get('debug_mode', False)

        print(f"\n[PROCESSING] Block: {block_type} (ID: {block_id}), Debug mode: {debug_mode}")
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
            return jsonify(result)

        elif block_type == 'text_splitter':
            chunk_size = int(config.get('chunk_size', 1000))
            overlap = int(config.get('chunk_overlap', 200))

            # Get input text
            input_text = config.get('content', '')

            print(f"[TEXT SPLITTER] Input text length: {len(input_text)}")
            print(f"[TEXT SPLITTER] Chunk size: {chunk_size}, Overlap: {overlap}")

            # For debug mode with no input text
            if not input_text and debug_mode:
                input_text = "Sample text for processing without proper input source. This is provided automatically in debug mode because no input text was found. This will allow you to test your text splitter configuration without needing a proper source connection."
                print(f"[TEXT SPLITTER] Warning: No input text provided, using sample text")

            # Simple word-based text splitting
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
            return jsonify(result)

        elif block_type == 'embedding':
            model = config.get('model', 'nomic-embed-text')

            # Try to get chunks from all possible input sources
            chunks = []

            # First look for chunks array
            if 'chunks' in config and isinstance(config['chunks'], list):
                chunks = config['chunks']
            # Look for a single text input
            elif 'input_text' in config:
                chunks = [config['input_text']]
            # Look for content from PDF loader
            elif 'content' in config:
                chunks = [config['content']]
            # Look for query from query input block
            elif 'query' in config:
                chunks = [config['query']]

            # If we've found nothing, try to split any text we can find
            if not chunks:
                for key, value in config.items():
                    if isinstance(value, str) and value.strip():
                        chunks = [value]
                        break

            print(f"[EMBEDDING] Config received: {config}")  # Debug print
            print(f"[EMBEDDING] Processing {len(chunks)} chunks with model: {model}")

            try:
                embeddings = []
                # Process each chunk
                for i, chunk in enumerate(chunks):
                    if not isinstance(chunk, str):
                        print(f"[EMBEDDING] Warning: Invalid chunk type at index {i}: {type(chunk)}")
                        chunk = str(chunk)

                    if not chunk.strip():
                        print(f"[EMBEDDING] Warning: Empty chunk at index {i}")

                    print(f"[EMBEDDING] Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})")
                    print(f"[EMBEDDING] Chunk content preview: {chunk[:100]}...")  # Debug print

                    # Handle very large chunks by truncating if needed
                    if len(chunk) > 8000:  # Adjust based on model limits
                        print(f"[EMBEDDING] Warning: Truncating chunk {i+1} from {len(chunk)} to 8000 chars")
                        chunk = chunk[:8000]

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
                print(f"[EMBEDDING] Success: Generated {len(embeddings)} embeddings")

            except Exception as e:
                error_msg = str(e)
                print(f"[EMBEDDING] Error: {error_msg}")
                result = {
                    'status': 'error',
                    'output': f"Error generating embeddings: {error_msg}",
                    'embeddings': [],
                    'block_id': block_id
                }

            return jsonify(result)

        elif block_type == 'vector_store':
            from langchain.vectorstores import FAISS
            from langchain.docstore.document import Document
            from langchain.embeddings.base import Embeddings

            # Create a dummy embedding class that doesn't compute anything
            class DummyEmbeddings:
                def embed_documents(self, texts):
                    # This won't be called since we're providing pre-computed embeddings
                    return [np.zeros(768) for _ in texts]
                
                def embed_query(self, text):
                    # This won't be called for the same reason
                    return np.zeros(768)

            # Get embedded chunks and embedded query
            embedded_chunks = config.get('chunks_embedded', [])

            # Look for embedded query from embedding block
            embedded_query = None
            # First check if we have an embedded query dictionary with text and embedding
            if 'embedded_query' in config and isinstance(config['embedded_query'], dict):
                embedded_query = config['embedded_query']
            # Then check if we have a list of embedded queries (take the first one)
            elif 'embedded_query' in config and isinstance(config['embedded_query'], list) and len(config['embedded_query']) > 0:
                embedded_query = config['embedded_query'][0]

            # Also check for a raw query (text only) as fallback
            query_text = config.get('query', '')

            # Get top_k parameter
            top_k = int(config.get('top_k', 3))

            print(f"[VECTOR STORE] Processing {len(embedded_chunks)} embedded chunks")
            if embedded_query:
                print(f"[VECTOR STORE] Using embedded query: {embedded_query.get('text', 'Unknown')}")
            elif query_text:
                print(f"[VECTOR STORE] Using text query (will be embedded): {query_text}")
            else:
                print(f"[VECTOR STORE] No query provided")
                # Initialize context to empty string to avoid undefined variable error
                context = ""
            print(f"[VECTOR STORE] Top K: {top_k}")

            # Check if we have the required data
            if not embedded_chunks:
                return jsonify({
                    'status': 'error',
                    'output': "No embedded chunks provided",
                    'context': "",
                    'retrieved_chunks': [],
                    'chunks': [],
                    'block_id': block_id
                })

            try:
                # Get and validate embedded chunks
                if not embedded_chunks:
                    print("[VECTOR STORE] No embedded chunks provided")
                    if debug_mode:
                        # Create sample embedded chunks for debug mode
                        print("[VECTOR STORE] Creating sample embedded chunks for debug mode")
                        import random
                        sample_chunks = ["Sample text chunk 1", "Sample text chunk 2", "Sample text chunk 3"]
                        embedded_chunks = []
                        for i, text in enumerate(sample_chunks):
                            # Generate a 768-dimension random embedding for testing
                            embedding = [random.uniform(-1, 1) for _ in range(768)]
                            embedded_chunks.append({"text": text, "embedding": embedding})
                    else:
                        raise ValueError("No embedded chunks provided")

                # Print diagnostics about embedded chunks
                print(f"[VECTOR STORE] Processing {len(embedded_chunks)} embedded chunks")
                for i, chunk in enumerate(embedded_chunks[:3]):  # Print sample of first 3 chunks
                    chunk_type = type(chunk)
                    print(f"[VECTOR STORE] Chunk {i+1} type: {chunk_type}")
                    if isinstance(chunk, dict):
                        text = chunk.get('text', '')
                        embedding = chunk.get('embedding', [])
                        print(f"[VECTOR STORE] Chunk {i+1} text type: {type(text)}, preview: {str(text)[:30]}")
                        print(f"[VECTOR STORE] Chunk {i+1} embedding length: {len(embedding)}")

                # Create Document objects for FAISS
                documents = []
                embeddings_list = []

                for i, chunk in enumerate(embedded_chunks):
                    try:
                        if not isinstance(chunk, dict):
                            print(f"[VECTOR STORE] Warning: Skipping non-dict chunk {i}: {type(chunk)}")
                            continue

                        text = chunk.get('text', '')
                        embedding = chunk.get('embedding', [])

                        # Handle potentially nested Document objects
                        if isinstance(text, Document):
                            print(f"[VECTOR STORE] Found Document object instead of string, extracting page_content")
                            text = text.page_content
                        elif hasattr(text, 'page_content'):
                            print(f"[VECTOR STORE] Found object with page_content attribute, extracting it")
                            text = text.page_content

                        # Ensure text is a string
                        if not isinstance(text, str):
                            print(f"[VECTOR STORE] Converting non-string content to string: {type(text)}")
                            text = str(text)

                        if not text or not embedding:
                            print(f"[VECTOR STORE] Skipping chunk {i}: Missing text or embedding")
                            continue

                        # Create Document object with the extracted string text
                        documents.append(Document(page_content=text, metadata={}))
                        embeddings_list.append(embedding)
                    except Exception as chunk_error:
                        print(f"[VECTOR STORE] Error processing chunk {i}: {str(chunk_error)}")
                        continue

                # Validate we have documents and embeddings to process
                if not documents or not embeddings_list:
                    raise ValueError("No valid documents or embeddings to store")

                # Create FAISS index
                try:
                    print("[VECTOR STORE] Creating FAISS index with embeddings")
                    
                    # Create a list of (Document, embedding) tuples
                    text_embeddings = []
                    for i, (doc, emb) in enumerate(zip(documents, embeddings_list)):
                        try:
                            # Ensure we're working with strings for document content
                            if isinstance(doc, Document):
                                # Already a Document object
                                text_embeddings.append((doc, emb))
                            else:
                                # Create a new Document with the text
                                text = str(doc) if not isinstance(doc, str) else doc
                                text_embeddings.append((Document(page_content=text, metadata={}), emb))
                        except Exception as e:
                            print(f"[VECTOR STORE] Error processing document {i}: {str(e)}")
                    
                    # Create the vector store using FAISS directly
                    embeddings_array = np.array([emb for _, emb in text_embeddings])
                    texts = [doc.page_content for doc, _ in text_embeddings]

                    # Create a mapping from index to document ID
                    index_to_docstore_id = {i: str(i) for i in range(len(texts))}

                    # Create a docstore with the documents
                    docstore = InMemoryDocstore({
                        str(i): Document(page_content=text, metadata={}) 
                        for i, text in enumerate(texts)
                    })

                    # Create the FAISS index
                    dimension = embeddings_array.shape[1]
                    index = faiss.IndexFlatL2(dimension)
                    index.add(embeddings_array)

                    # Create the vector store
                    vector_store = FAISS(
                        embedding_function=lambda x: np.zeros(dimension),  # Dummy function
                        index=index,
                        docstore=docstore,
                        index_to_docstore_id=index_to_docstore_id
                    )

                    print(f"[VECTOR STORE] Successfully created FAISS index with {len(text_embeddings)} documents")
                except Exception as e:
                    print(f"[VECTOR STORE] Error creating FAISS index: {str(e)}")
                    raise

                # Get query embedding - either use provided embedding or generate one
                query_embedding = []

                if embedded_query and 'embedding' in embedded_query:
                    # Use the provided embedding
                    query_embedding = embedded_query['embedding']
                    print(f"[VECTOR STORE] Using provided query embedding (size: {len(query_embedding)})")
                elif query_text:
                    # Generate embedding for the query text
                    print(f"[VECTOR STORE] Generating embedding for query text: {query_text}")
                    response = requests.post('http://localhost:11434/api/embeddings', json={
                        'model': 'nomic-embed-text',
                        'prompt': query_text
                    })
                    if response.status_code != 200:
                        raise Exception(f"Failed to get query embedding: {response.text}")

                    query_embedding = response.json().get('embedding', [])
                else:
                    raise ValueError("No query or query embedding provided")

                # Perform similarity search
                retrieved_docs = vector_store.similarity_search_by_vector(query_embedding, k=top_k)

                # Extract chunks and combine into context
                retrieved_chunks = [doc.page_content for doc in retrieved_docs]
                context = "\n\n".join(retrieved_chunks)

                # Log what is being returned
                print(f"[VECTOR STORE] Retrieved {len(retrieved_chunks)} chunks for query")
                for i, chunk in enumerate(retrieved_chunks):
                    print(f"[VECTOR STORE] Chunk {i+1}: {chunk[:50]}...")

                # Create result with chunks in multiple formats to ensure compatibility
                result = {
                    'status': 'success',
                    'output': f"Retrieved top {top_k} documents for query",
                    'context': context,
                    'retrieved_chunks': retrieved_chunks,
                    'chunks': retrieved_chunks,  # Include as chunks to be consistent with other blocks
                    'block_id': block_id
                }

                # Log the structure of the result for debugging
                print(f"[VECTOR STORE] Result keys: {', '.join(result.keys())}")

            except Exception as e:
                result = {
                    'status': 'error',
                    'output': f"Error in vector store: {str(e)}",
                    'context': "",
                    'retrieved_chunks': [],
                    'chunks': [],
                    'block_id': block_id
                }
                print(f"[VECTOR STORE] Error: {str(e)}")

        elif block_type == 'query_input':
            query = config.get('query', '')
            # Get the query from the chat input if available
            chat_input = config.get('chat_input', '')
            if chat_input:
                query = chat_input

            # Check if query is empty and provide appropriate response
            if not query:
                # Just log a warning but don't replace with a sample
                print(f"[QUERY INPUT] Warning: Empty query received")
            
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

            # In debug mode, provide a sample prompt if missing
            if debug_mode and not prompt:
                prompt = "You are a helpful assistant. Please provide a concise answer to the following query: {query}"
                print(f"[AI MODEL] Debug mode: No prompt template provided, using sample prompt")

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

            # In debug mode, provide sample data if missing
            try:
                from sentence_transformers import CrossEncoder

                # Add fallback for missing data
            
                # Simplified ranking for debug mode to avoid expensive model loading
                if debug_mode:
                    print(f"[RETRIEVAL RANKING] Using simplified scoring in debug mode")

                    # Simple keyword matching score
                    def simple_score(query, chunk):
                        query_tokens = set(query.lower().split())
                        chunk_tokens = set(chunk.lower().split())
                        matches = len(query_tokens.intersection(chunk_tokens))
                        return matches / max(len(query_tokens), 1)

                    scores = [simple_score(query, chunk) for chunk in chunks]
                    ranked_pairs = list(zip(chunks, scores))
                    ranked_pairs.sort(key=lambda x: x[1], reverse=True)

                    ranked_chunks = [pair[0] for pair in ranked_pairs]
                    context = "\n\n".join(ranked_chunks)

                else:
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
                    'scores': [float(score) for score in scores],
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
