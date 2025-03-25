from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import time
import subprocess
import platform
from blocks import (
    Canvas,
    Block,
)
import numpy as np
import faiss
from langchain_community.docstore.in_memory import InMemoryDocstore
import pkgutil
import importlib
import inspect
import functools
from werkzeug.utils import secure_filename
from datetime import datetime
import traceback

app = Flask(__name__, static_folder="static")
CORS(app)

# Global canvas instance
canvas = Canvas()

# Dictionary to store block connections and their associated functions
block_connections = {}

# Add a simple caching mechanism to prevent duplicate calls
ai_model_cache = {}

# Set up cache for expensive operations
class SimpleCache:
    def __init__(self, max_size=100):
        self.cache = {}
        self.max_size = max_size

    def get(self, key):
        return self.cache.get(key)

    def set(self, key, value):
        if len(self.cache) >= self.max_size:
            # Simple eviction strategy: remove a random item
            self.cache.pop(next(iter(self.cache)))
        self.cache[key] = value

    def clear(self):
        self.cache.clear()

# Initialize caches
module_classes_cache = SimpleCache(max_size=50)
class_details_cache = SimpleCache(max_size=50)


def is_ollama_running():
    try:
        response = requests.get("http://localhost:11434/api/version")
        return response.status_code == 200
    except requests.RequestException:
        return False


def start_ollama():
    system = platform.system().lower()
    try:
        if system == "windows":
            # Check for Ollama installation
            possible_paths = [
                os.path.expandvars(r"%LOCALAPPDATA%\Ollama\ollama.exe"),
                r"C:\Program Files\Ollama\ollama.exe",
                os.path.expandvars(r"%ProgramFiles%\Ollama\ollama.exe"),
            ]

            ollama_path = None
            for path in possible_paths:
                if os.path.exists(path):
                    ollama_path = path
                    break

            if ollama_path:
                try:
                    # First try normal start
                    subprocess.Popen(
                        [ollama_path, "serve"],
                        creationflags=subprocess.CREATE_NO_WINDOW,
                    )
                    time.sleep(2)
                    if is_ollama_running():
                        return {
                            "success": True,
                            "message": "Ollama started successfully",
                        }

                    # If normal start failed, try with admin rights
                    try:
                        subprocess.Popen(
                            ["runas", "/user:Administrator", ollama_path, "serve"],
                            creationflags=subprocess.CREATE_NO_WINDOW,
                        )
                        time.sleep(2)
                        if is_ollama_running():
                            return {
                                "success": True,
                                "message": "Ollama started successfully with admin rights",
                            }
                    except subprocess.SubprocessError:
                        return {
                            "success": False,
                            "message": "Failed to start Ollama. Please start it manually from the Start menu",
                        }
                except Exception as e:
                    return {
                        "success": False,
                        "message": f"Found Ollama but failed to start it. Please start it manually: {str(e)}",
                    }
            else:
                return {
                    "success": False,
                    "message": "Ollama not found. Please install it from https://ollama.ai/download",
                    "needsInstall": True,
                }

        elif system in ["darwin", "linux"]:  # macOS and Linux
            try:
                # Try normal start first
                subprocess.Popen(["ollama", "serve"])
                time.sleep(2)
                if is_ollama_running():
                    return {"success": True, "message": "Ollama started successfully"}

                # If normal start failed, try with sudo
                try:
                    subprocess.Popen(
                        ["pkexec", "ollama", "serve"]
                    )  # Use pkexec for GUI sudo prompt
                    time.sleep(2)
                    if is_ollama_running():
                        return {
                            "success": True,
                            "message": "Ollama started successfully with admin rights",
                        }
                except subprocess.SubprocessError:
                    return {
                        "success": False,
                        "message": "Failed to start Ollama. Please start it manually using: ollama serve",
                    }
            except FileNotFoundError:
                return {
                    "success": False,
                    "message": "Ollama not found. Please install it first",
                    "needsInstall": True,
                }
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Failed to start Ollama. Please start it manually: {str(e)}",
                }

        return {"success": False, "message": "Unsupported operating system"}
    except Exception as e:
        return {"success": False, "message": f"Error starting Ollama: {str(e)}"}


def ensure_ollama_is_running():
    if not is_ollama_running():
        print(
            "\nOllama is not running! The LLM features will not work until Ollama is started."
        )
        print("You can start Ollama from the web interface or manually:\n")
        if platform.system().lower() == "windows":
            print("   - Run the Ollama application from your Start menu")
        else:
            print("   - Open a terminal and run: ollama serve")


@app.route("/")
def serve_static():
    return app.send_static_file("index.html")


@app.route("/api/connect", methods=["POST"])
def connect_blocks():
    data = request.json
    source_id = data.get("source")
    target_id = data.get("target")
    input_id = data.get("inputId")

    # Store the connection
    connection_id = f"{source_id}-{target_id}-{input_id}"
    block_connections[connection_id] = {
        "source": source_id,
        "target": target_id,
        "inputId": input_id,
        "function": None,
    }

    return jsonify({"status": "success", "connection_id": connection_id})


@app.route("/api/connections", methods=["GET"])
def get_connections():
    return jsonify(block_connections)


@app.route("/api/generate", methods=["POST"])
def generate_text():
    if not is_ollama_running():
        return (
            jsonify(
                {"error": "Ollama is not running. Please start Ollama and try again."}
            ),
            503,
        )

    data = request.json
    input_text = data.get("input", "")
    model_name = data.get(
        "model", "tinyllama"
    )  # Default to tinyllama if no model specified

    # Ollama API endpoint
    url = "http://localhost:11434/api/generate"

    # Request payload for Ollama
    payload = {"model": model_name, "prompt": input_text, "stream": False}

    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            result = response.json()
            return jsonify({"output": result.get("response", "")})
        else:
            return jsonify({"error": "Failed to generate response"}), 500
    except requests.exceptions.ConnectionError:
        return (
            jsonify(
                {
                    "error": "Could not connect to Ollama. Please make sure Ollama is running."
                }
            ),
            503,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/system/status", methods=["GET"])
def get_system_status():
    ollama_running = is_ollama_running()
    return jsonify({"ollama_status": "running" if ollama_running else "not_running"})


@app.route("/api/system/install-ollama", methods=["POST"])
def install_ollama():
    system = platform.system().lower()
    try:
        if system == "windows":
            # Download Windows installer
            url = "https://ollama.ai/download/windows"
            return jsonify({"status": "manual_install_required", "download_url": url})
        elif system == "darwin":
            subprocess.run(["brew", "install", "ollama"])
        elif system == "linux":
            # Add appropriate Linux installation commands
            subprocess.run(
                ["curl", "-fsSL", "https://ollama.ai/install.sh", "|", "bash"]
            )

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/system/start-ollama", methods=["POST"])
def start_ollama_endpoint():
    try:
        if is_ollama_running():
            return jsonify(
                {"status": "success", "message": "Ollama is already running"}
            )

        result = start_ollama()
        if result["success"]:
            # Wait for Ollama to be fully running
            for _ in range(5):  # Try for 10 seconds
                if is_ollama_running():
                    return jsonify({"status": "success", "message": result["message"]})
                time.sleep(2)
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Started Ollama but service is not responding",
                    }
                ),
                500,
            )
        else:
            # If Ollama isn't installed, provide download URL
            if "not found" in result["message"].lower():
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": result["message"],
                            "needsInstall": True,
                            "downloadUrl": "https://ollama.ai/download",
                        }
                    ),
                    404,
                )
            return jsonify({"status": "error", "message": result["message"]}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/models/list", methods=["GET"])
def list_models():
    if not is_ollama_running():
        return jsonify({"error": "Ollama is not running"}), 503

    try:
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            data = response.json()
            # Format the response to match what the frontend expects
            models = {
                "models": [
                    {"name": model["name"], "size": model.get("size", 0)}
                    for model in data["models"]
                ]
            }
            return jsonify(models)
        return jsonify({"error": "Failed to fetch models"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/blocks/create", methods=["POST"])
def create_block():
    data = request.json
    block_type = data.get("type")
    block_id = data.get("id")

    if not block_type or not block_id:
        return jsonify({"error": "Missing block type or ID"}), 400

    return jsonify({"error": "Invalid block type. Only custom blocks are allowed."}), 400


@app.route("/api/blocks/connect", methods=["POST"])
def connect_block_nodes():
    data = request.json
    source_id = data.get("source")
    target_id = data.get("target")

    if not source_id or not target_id:
        return jsonify({"error": "Missing source or target ID"}), 400

    try:
        success = canvas.connect_blocks(source_id, target_id)
        if success:
            return jsonify(
                {"status": "success", "message": "Blocks connected successfully"}
            )
        else:
            return jsonify({"error": "Invalid connection"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/blocks/export", methods=["POST"])
def export_blocks():
    data = request.json
    output_file = data.get("output_file", "generated_rag.py")

    try:
        canvas.export_to_python(output_file)
        return jsonify(
            {
                "status": "success",
                "message": f"Successfully exported to {output_file}",
                "file": output_file,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/blocks/list", methods=["GET"])
def list_blocks():
    try:
        blocks = {
            block_id: type(block).__name__ for block_id, block in canvas.blocks.items()
        }
        return jsonify({"blocks": blocks, "connections": canvas.connections})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/blocks/process", methods=["POST"])
def process_block():
    try:
        data = request.json
        block_id = data.get("block_id")
        block_type = data.get("type")
        config = data.get("config", {})
        debug_mode = data.get("debug_mode", False)

        print(
            f"\n[PROCESSING] Block: {block_type} (ID: {block_id}), Debug mode: {debug_mode}"
        )
        if block_id != "block-7":
            print(f"[PROCESSING] Config: {config}")
            print(f"[PROCESSING] Config keys: {list(config.keys())}")

        # Special handling for different block types
        if block_type == "pdf_loader":
            files = config.get("files", [])
            try:
                from PyPDF2 import PdfReader

                content = []
                for file in files:
                    reader = PdfReader(file)
                    for page in reader.pages:
                        content.append(page.extract_text())

                full_content = "\n\n".join(content)
                result = {
                    "status": "success",
                    "output": f"Loaded {len(files)} PDF files",
                    "content": full_content,
                    "block_id": block_id,
                }
                print(f"[PDF LOADER] Loaded {len(files)} files: {files}")
                print(f"[PDF LOADER] Extracted {len(content)} pages of text")
            except Exception as e:
                result = {
                    "status": "error",
                    "output": f"Error loading PDFs: {str(e)}",
                    "content": "",
                    "block_id": block_id,
                }
            return jsonify(result)

        elif block_type == "text_splitter":
            chunk_size = int(config.get("chunk_size", 1000))
            overlap = int(config.get("chunk_overlap", 200))

            # Get input text
            input_text = config.get("content", "")

            print(f"[TEXT SPLITTER] Input text length: {len(input_text)}")
            print(f"[TEXT SPLITTER] Chunk size: {chunk_size}, Overlap: {overlap}")

            # For debug mode with no input text
            if not input_text and debug_mode:
                input_text = "Sample text for processing without proper input source. This is provided automatically in debug mode because no input text was found. This will allow you to test your text splitter configuration without needing a proper source connection."
                print(
                    "[TEXT SPLITTER] Warning: No input text provided, using sample text"
                )

            # Simple word-based text splitting
            chunks = []
            words = input_text.split()
            current_chunk = []
            current_length = 0

            for word in words:
                word_length = len(word)

                # If adding this word would exceed chunk size, save current chunk
                if current_length + word_length + 1 > chunk_size and current_chunk:
                    chunk_text = " ".join(current_chunk)
                    chunks.append(chunk_text)

                    # Keep overlap words for next chunk
                    if overlap > 0:
                        # Calculate how many words to keep based on overlap size
                        overlap_text = " ".join(current_chunk[-overlap:])
                        current_chunk = current_chunk[-overlap:]
                        current_length = len(overlap_text)
                    else:
                        current_chunk = []
                        current_length = 0

                current_chunk.append(word)
                current_length += word_length + 1  # +1 for space

            # Add the last chunk if there's anything left
            if current_chunk:
                chunk_text = " ".join(current_chunk)
                chunks.append(chunk_text)

            print(f"[TEXT SPLITTER] Generated {len(chunks)} chunks")
            for i, chunk in enumerate(chunks[:3]):  # Print first 3 chunks for debugging
                print(f"[TEXT SPLITTER] Chunk {i+1} preview: {chunk[:100]}...")

            result = {
                "status": "success",
                "output": f"Split text into {len(chunks)} chunks",
                "chunks": chunks,
                "block_id": block_id,
            }
            print(f"[TEXT SPLITTER] Success: Generated {len(chunks)} chunks")
            return jsonify(result)

        elif block_type == "embedding":
            model = config.get("model", "nomic-embed-text")

            # Try to get chunks from all possible input sources
            chunks = []

            # First look for chunks array
            if "chunks" in config and isinstance(config["chunks"], list):
                chunks = config["chunks"]
            # Look for a single text input
            elif "input_text" in config:
                chunks = [config["input_text"]]
            # Look for content from PDF loader
            elif "content" in config:
                chunks = [config["content"]]
            # Look for query from query input block
            elif "query" in config:
                chunks = [config["query"]]

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
                        print(
                            f"[EMBEDDING] Warning: Invalid chunk type at index {i}: {type(chunk)}"
                        )
                        chunk = str(chunk)

                    if not chunk.strip():
                        print(f"[EMBEDDING] Warning: Empty chunk at index {i}")

                    print(
                        f"[EMBEDDING] Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})"
                    )
                    print(
                        f"[EMBEDDING] Chunk content preview: {chunk[:100]}..."
                    )  # Debug print

                    # Handle very large chunks by truncating if needed
                    if len(chunk) > 8000:  # Adjust based on model limits
                        print(
                            f"[EMBEDDING] Warning: Truncating chunk {i+1} from {len(chunk)} to 8000 chars"
                        )
                        chunk = chunk[:8000]

                    response = requests.post(
                        "http://localhost:11434/api/embeddings",
                        json={"model": model, "prompt": chunk},
                    )

                    if response.status_code == 200:
                        resp_data = response.json()
                        vector = resp_data.get("embedding", [])

                        if not vector:
                            print(
                                f"[EMBEDDING] Warning: Empty embedding vector for chunk {i+1}"
                            )
                            continue

                        embeddings.append({"text": chunk, "embedding": vector})
                        print(
                            f"[EMBEDDING] Successfully embedded chunk {i+1} (vector size: {len(vector)})"
                        )
                    else:
                        print(f"[EMBEDDING] Error for chunk {i+1}: {response.text}")
                        raise Exception(f"Failed to get embedding: {response.text}")

                if not embeddings:
                    raise ValueError("No valid embeddings were generated")

                result = {
                    "status": "success",
                    "output": f"Generated {len(embeddings)} embeddings using {model} model",
                    "embeddings": embeddings,
                    "block_id": block_id,
                }
                print(f"[EMBEDDING] Success: Generated {len(embeddings)} embeddings")

            except Exception as e:
                error_msg = str(e)
                print(f"[EMBEDDING] Error: {error_msg}")
                result = {
                    "status": "error",
                    "output": f"Error generating embeddings: {error_msg}",
                    "embeddings": [],
                    "block_id": block_id,
                }

            return jsonify(result)

        elif block_type == "vector_store":
            from langchain.vectorstores import FAISS
            from langchain.docstore.document import Document

            # Create a dummy embedding class that doesn't compute anything
            class DummyEmbeddings:
                def embed_documents(self, texts):
                    # This won't be called since we're providing pre-computed embeddings
                    return [np.zeros(768) for _ in texts]

                def embed_query(self, text):
                    # This won't be called for the same reason
                    return np.zeros(768)

            # Get embedded chunks and embedded query
            embedded_chunks = config.get("chunks_embedded", [])

            # Look for embedded query from embedding block
            embedded_query = None
            # First check if we have an embedded query dictionary with text and embedding
            if "embedded_query" in config and isinstance(
                config["embedded_query"], dict
            ):
                embedded_query = config["embedded_query"]
            # Then check if we have a list of embedded queries (take the first one)
            elif (
                "embedded_query" in config
                and isinstance(config["embedded_query"], list)
                and len(config["embedded_query"]) > 0
            ):
                embedded_query = config["embedded_query"][0]

            # Also check for a raw query (text only) as fallback
            query_text = config.get("query", "")

            # Get top_k parameter
            top_k = int(config.get("top_k", 3))

            print(f"[VECTOR STORE] Processing {len(embedded_chunks)} embedded chunks")
            if embedded_query:
                print(
                    f"[VECTOR STORE] Using embedded query: {embedded_query.get('text', 'Unknown')}"
                )
            elif query_text:
                print(
                    f"[VECTOR STORE] Using text query (will be embedded): {query_text}"
                )
            else:
                print("[VECTOR STORE] No query provided")
                # Initialize context to empty string to avoid undefined variable error
                context = ""
            print(f"[VECTOR STORE] Top K: {top_k}")

            # Check if we have the required data
            if not embedded_chunks:
                return jsonify(
                    {
                        "status": "error",
                        "output": "No embedded chunks provided",
                        "context": "",
                        "retrieved_chunks": [],
                        "chunks": [],
                        "block_id": block_id,
                    }
                )

            try:
                # Get and validate embedded chunks
                if not embedded_chunks:
                    print("[VECTOR STORE] No embedded chunks provided")
                    if debug_mode:
                        # Create sample embedded chunks for debug mode
                        print(
                            "[VECTOR STORE] Creating sample embedded chunks for debug mode"
                        )
                        import random

                        sample_chunks = [
                            "Sample text chunk 1",
                            "Sample text chunk 2",
                            "Sample text chunk 3",
                        ]
                        embedded_chunks = []
                        for i, text in enumerate(sample_chunks):
                            # Generate a 768-dimension random embedding for testing
                            embedding = [random.uniform(-1, 1) for _ in range(768)]
                            embedded_chunks.append(
                                {"text": text, "embedding": embedding}
                            )
                    else:
                        raise ValueError("No embedded chunks provided")

                # Print diagnostics about embedded chunks
                print(
                    f"[VECTOR STORE] Processing {len(embedded_chunks)} embedded chunks"
                )
                for i, chunk in enumerate(
                    embedded_chunks[:3]
                ):  # Print sample of first 3 chunks
                    chunk_type = type(chunk)
                    print(f"[VECTOR STORE] Chunk {i+1} type: {chunk_type}")
                    if isinstance(chunk, dict):
                        text = chunk.get("text", "")
                        embedding = chunk.get("embedding", [])
                        print(
                            f"[VECTOR STORE] Chunk {i+1} text type: {type(text)}, preview: {str(text)[:30]}"
                        )
                        print(
                            f"[VECTOR STORE] Chunk {i+1} embedding length: {len(embedding)}"
                        )

                # Create Document objects for FAISS
                documents = []
                embeddings_list = []

                for i, chunk in enumerate(embedded_chunks):
                    try:
                        if not isinstance(chunk, dict):
                            print(
                                f"[VECTOR STORE] Warning: Skipping non-dict chunk {i}: {type(chunk)}"
                            )
                            continue

                        text = chunk.get("text", "")
                        embedding = chunk.get("embedding", [])

                        # Handle potentially nested Document objects
                        if isinstance(text, Document):
                            print(
                                "[VECTOR STORE] Found Document object instead of string, extracting page_content"
                            )
                            text = text.page_content
                        elif hasattr(text, "page_content"):
                            print(
                                "[VECTOR STORE] Found object with page_content attribute, extracting it"
                            )
                            text = text.page_content

                        # Ensure text is a string
                        if not isinstance(text, str):
                            print(
                                f"[VECTOR STORE] Converting non-string content to string: {type(text)}"
                            )
                            text = str(text)

                        if not text or not embedding:
                            print(
                                f"[VECTOR STORE] Skipping chunk {i}: Missing text or embedding"
                            )
                            continue

                        # Create Document object with the extracted string text
                        documents.append(Document(page_content=text, metadata={}))
                        embeddings_list.append(embedding)
                    except Exception as chunk_error:
                        print(
                            f"[VECTOR STORE] Error processing chunk {i}: {str(chunk_error)}"
                        )
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
                                text_embeddings.append(
                                    (Document(page_content=text, metadata={}), emb)
                                )
                        except Exception as e:
                            print(
                                f"[VECTOR STORE] Error processing document {i}: {str(e)}"
                            )

                    # Create the vector store using FAISS directly
                    embeddings_array = np.array([emb for _, emb in text_embeddings])
                    texts = [doc.page_content for doc, _ in text_embeddings]

                    # Create a mapping from index to document ID
                    index_to_docstore_id = {i: str(i) for i in range(len(texts))}

                    # Create a docstore with the documents
                    docstore = InMemoryDocstore(
                        {
                            str(i): Document(page_content=text, metadata={})
                            for i, text in enumerate(texts)
                        }
                    )

                    # Create the FAISS index
                    dimension = embeddings_array.shape[1]
                    index = faiss.IndexFlatL2(dimension)
                    # Ensure embeddings_array is the right type
                    embeddings_array = np.array(embeddings_array, dtype=np.float32)
                    index.add(embeddings_array)

                    # Create the vector store
                    vector_store = FAISS(
                        embedding_function=lambda x: np.zeros(
                            dimension
                        ),  # Dummy function
                        index=index,
                        docstore=docstore,
                        index_to_docstore_id=index_to_docstore_id,
                    )

                    print(
                        f"[VECTOR STORE] Successfully created FAISS index with {len(text_embeddings)} documents"
                    )
                except Exception as e:
                    print(f"[VECTOR STORE] Error creating FAISS index: {str(e)}")
                    raise

                # Get query embedding - either use provided embedding or generate one
                query_embedding = []

                if embedded_query and "embedding" in embedded_query:
                    # Use the provided embedding
                    query_embedding = embedded_query["embedding"]
                    print(
                        f"[VECTOR STORE] Using provided query embedding (size: {len(query_embedding)})"
                    )
                elif query_text:
                    # Generate embedding for the query text
                    print(
                        f"[VECTOR STORE] Generating embedding for query text: {query_text}"
                    )
                    response = requests.post(
                        "http://localhost:11434/api/embeddings",
                        json={"model": "nomic-embed-text", "prompt": query_text},
                    )
                    if response.status_code != 200:
                        raise Exception(
                            f"Failed to get query embedding: {response.text}"
                        )

                    query_embedding = response.json().get("embedding", [])
                else:
                    raise ValueError("No query or query embedding provided")

                # Perform similarity search
                retrieved_docs = vector_store.similarity_search_by_vector(
                    query_embedding, k=top_k
                )

                # Extract chunks and combine into context
                retrieved_chunks = [doc.page_content for doc in retrieved_docs]
                context = "\n\n".join(retrieved_chunks)

                # Log what is being returned
                print(
                    f"[VECTOR STORE] Retrieved {len(retrieved_chunks)} chunks for query"
                )
                for i, chunk in enumerate(retrieved_chunks):
                    print(f"[VECTOR STORE] Chunk {i+1}: {chunk[:50]}...")

                # Create result with chunks in multiple formats to ensure compatibility
                result = {
                    "status": "success",
                    "output": f"Retrieved top {top_k} documents for query",
                    "context": context,
                    "retrieved_chunks": retrieved_chunks,
                    "chunks": retrieved_chunks,  # Include as chunks to be consistent with other blocks
                    "block_id": block_id,
                }

                # Log the structure of the result for debugging
                print(f"[VECTOR STORE] Result keys: {', '.join(result.keys())}")

            except Exception as e:
                result = {
                    "status": "error",
                    "output": f"Error in vector store: {str(e)}",
                    "context": "",
                    "retrieved_chunks": [],
                    "chunks": [],
                    "block_id": block_id,
                }
                print(f"[VECTOR STORE] Error: {str(e)}")

        elif block_type == "query_input":
            query = config.get("query", "")
            # Get the query from the chat input if available
            chat_input = config.get("chat_input", "")
            if chat_input:
                query = chat_input

            # Check if query is empty and provide appropriate response
            if not query:
                # Just log a warning but don't replace with a sample
                print("[QUERY INPUT] Warning: Empty query received")

            result = {
                "status": "success",
                "output": "Query received",
                "query": query,
                "block_id": block_id,
            }
            print(f"[QUERY INPUT] Query: {query}")

        elif block_type == "ai_model":
            model = config.get("model", "tinyllama")
            temp = config.get("temperature", 0.75)
            prompt_template = config.get("prompt", "")

            # Extract query from various possible sources
            query = ""

            # First check direct query parameter
            if "query" in config:
                query_data = config["query"]
                if isinstance(query_data, str):
                    query = query_data
                elif isinstance(query_data, dict) and "query" in query_data:
                    query = query_data["query"]

            # Then check Query input object
            if not query and "Query" in config:
                query_obj = config["Query"]
                if isinstance(query_obj, dict) and "query" in query_obj:
                    query = query_obj["query"]

            # Extract context from various possible sources
            context = ""

            # First check direct context parameter
            if "context" in config:
                context_data = config["context"]
                if isinstance(context_data, str):
                    context = context_data

            # Then check Context input object
            if not context and "Context" in config:
                context_obj = config["Context"]
                if isinstance(context_obj, dict) and "context" in context_obj:
                    context = context_obj["context"]

            print(f"[AI MODEL] DEBUG - Query object type: {type(query)}")
            print(f"[AI MODEL] DEBUG - Query value: {query}")

            # IMPORTANT: Instead of using the template from the request, create a new one
            # This ensures we don't use a template that might have been corrupted
            prompt_template = """Answer the following question using the provided context. If the context doesn't contain enough information, say so.

Context: {context}

Question: {query}

Answer:"""

            print("[AI MODEL] Using fixed prompt template")

            # Format the prompt with the actual values
            prompt = prompt_template.replace("{context}", context).replace(
                "{query}", query
            )

            print(f"[AI MODEL] Model: {model}, Temperature: {temp}")
            print(f"[AI MODEL] Query: {query}")
            print(
                f"[AI MODEL] Context: {context[:100]}..."
            )  # Print first 100 chars of context
            print(
                f"[AI MODEL] Formatted prompt: {prompt[:200]}..."
            )  # Print first 200 chars

            # Add this before making the API call:
            cache_key = f"{model}_{temp}_{prompt}"
            if cache_key in ai_model_cache:
                print("[AI MODEL] Using cached response")
                result = ai_model_cache[cache_key]
                return jsonify(result)

            # Call Ollama API for generation
            try:
                response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "temperature": temp,
                        "stream": False,
                    },
                )

                if response.status_code == 200:
                    generated_text = response.json().get("response", "")
                    result = {
                        "status": "success",
                        "output": f"Generated response using {model} with temperature {temp}",
                        "answer": generated_text,
                        "block_id": block_id,
                    }
                    # Cache the result
                    ai_model_cache[cache_key] = result
                    print(f"[AI MODEL] Generated answer: {generated_text}")
                else:
                    result = {
                        "status": "error",
                        "output": f"Failed to generate response: {response.text}",
                        "answer": "Error: Failed to generate response",
                        "block_id": block_id,
                    }
                    print(f"[AI MODEL] Error response: {response.text}")
            except Exception as e:
                result = {
                    "status": "error",
                    "output": f"Error calling Ollama: {str(e)}",
                    "answer": f"Error: {str(e)}",
                    "block_id": block_id,
                }
                print(f"[AI MODEL] Exception: {str(e)}")

        elif block_type == "retrieval_ranking":
            method = config.get("ranking_method", "similarity")
            chunks = config.get("chunks", [])
            query = config.get("query", "")

            # In debug mode, provide sample data if missing
            try:
                # Try to import sentence_transformers, but provide fallback if not available
                try:
                    from sentence_transformers import CrossEncoder
                except ImportError:
                    # Create a simple fallback implementation
                    class CrossEncoder:
                        def __init__(self, model_name):
                            print(
                                "Warning: Using fallback CrossEncoder (sentence_transformers not installed)"
                            )
                            self.model_name = model_name

                        def predict(self, pairs):
                            # Simple fallback scoring based on word overlap
                            scores = []
                            for query, chunk in pairs:
                                query_words = set(query.lower().split())
                                chunk_words = set(chunk.lower().split())
                                if not query_words:
                                    scores.append(0.0)
                                    continue
                                overlap = len(query_words.intersection(chunk_words))
                                score = overlap / len(query_words)
                                scores.append(float(score))
                            return scores

                # Add fallback for missing data

                # Simplified ranking for debug mode to avoid expensive model loading
                if debug_mode:
                    print("[RETRIEVAL RANKING] Using simplified scoring in debug mode")

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
                    model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

                    # Score each chunk
                    pairs = [[query, chunk] for chunk in chunks]
                    scores = model.predict(pairs)

                    # Sort chunks by score
                    ranked_pairs = list(zip(chunks, scores))
                    ranked_pairs.sort(key=lambda x: x[1], reverse=True)

                    ranked_chunks = [pair[0] for pair in ranked_pairs]
                    context = "\n\n".join(ranked_chunks)

                result = {
                    "status": "success",
                    "output": f"Ranked retrieval results using {method}",
                    "ranked_chunks": ranked_chunks,
                    "context": context,
                    "scores": [float(score) for score in scores],
                    "block_id": block_id,
                }
                print(f"[RETRIEVAL RANKING] Ranked {len(ranked_chunks)} chunks")
                for i, (chunk, score) in enumerate(ranked_pairs):
                    print(
                        f"[RETRIEVAL RANKING] Rank {i+1} (score: {score:.3f}): {chunk[:100]}..."
                    )
            except Exception as e:
                result = {
                    "status": "error",
                    "output": f"Error in ranking: {str(e)}",
                    "ranked_chunks": chunks,
                    "context": "\n\n".join(chunks),
                    "block_id": block_id,
                }
                print(f"[RETRIEVAL RANKING] Error: {str(e)}")

        elif block_type == "answer_display":
            result = {
                "status": "success",
                "output": "Display updated",
                "block_id": block_id,
            }
            print("[ANSWER DISPLAY] Updated display")

        else:
            # Fallback for any unhandled block types
            result = {
                "status": "error",
                "output": f"Unknown block type: {block_type}",
                "block_id": block_id,
            }
            print(f"[WARNING] Unknown block type: {block_type}")

        print(f"[COMPLETED] Block: {block_type} completed")
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] Block processing error: {str(e)}")
        return jsonify({"error": str(e), "status": "error"}), 500


# New API endpoints for custom blocks
@app.route("/api/langchain/libraries", methods=["GET"])
def list_langchain_libraries():
    """List available LangChain libraries that can be imported."""
    libraries = [
        "langchain_community",
        "langchain_core",
        "langchain_openai",
        "langchain_anthropic",
        "langchain_google_genai",
        "langchain_pinecone",
        "langchain_chroma",
    ]

    # Try to import each library to check if it's installed
    available_libraries = []
    for lib in libraries:
        try:
            importlib.import_module(lib)
            available_libraries.append(lib)
        except ImportError:
            # Library not available, skip it
            pass

    return jsonify({"libraries": available_libraries})

@app.route("/api/langchain/modules", methods=["GET"])
def list_langchain_modules():
    """List available modules within a LangChain library."""
    library = request.args.get("library", "langchain_community")

    try:
        # Import the base package
        package = importlib.import_module(library)

        # Get all modules in the package
        modules = []
        for finder, name, ispkg in pkgutil.iter_modules(package.__path__):
            if ispkg:  # Only include subpackages, not individual modules
                modules.append(f"{library}.{name}")

        # Sort the modules alphabetically
        modules.sort()

        return jsonify({"modules": modules})
    except ImportError:
        return jsonify({"error": f"Could not import {library}"}), 400

@app.route("/api/langchain/classes", methods=["GET"])
def list_langchain_classes():
    """List available classes within a LangChain module."""
    module_path = request.args.get("module", "langchain_community.document_loaders")

    # Check cache first
    cached_result = module_classes_cache.get(module_path)
    if cached_result:
        print(f"Using cached classes for {module_path}")
        return jsonify({"classes": cached_result})

    try:
        # Import the base package
        module = importlib.import_module(module_path)
        classes = []

        # First, try to get all submodules if this is a package
        submodules = []
        try:
            # Check if module has __path__ attribute (indicating it's a package)
            if hasattr(module, '__path__'):
                print(f"Scanning submodules in {module_path}")
                # Get all modules in the package (both modules and packages)
                for finder, name, ispkg in pkgutil.iter_modules(module.__path__):
                    submodule_name = f"{module_path}.{name}"
                    submodules.append(submodule_name)

                    # If this is a frequently used module, look deeper
                    if name in ['document_loaders', 'embeddings', 'llms', 'vectorstores']:
                        try:
                            sub = importlib.import_module(submodule_name)
                            if hasattr(sub, '__path__'):
                                for sub_finder, sub_name, sub_ispkg in pkgutil.iter_modules(sub.__path__):
                                    submodules.append(f"{submodule_name}.{sub_name}")
                        except ImportError:
                            pass
        except Exception as e:
            print(f"Error scanning submodules: {str(e)}")

        # Add the module itself to the list of modules to check
        modules_to_check = [module_path] + submodules

        print(f"Found {len(modules_to_check)} modules/submodules to check for classes")

        # Check each module for classes
        for mod_path in modules_to_check:
            try:
                mod = importlib.import_module(mod_path)

                # Get all attributes in the module that are classes
                for name, attr in inspect.getmembers(mod, inspect.isclass):
                    # Skip private attributes and avoid duplicates
                    if name.startswith('_') or name in classes:
                        continue

                    # Only include classes from this module or submodules
                    if hasattr(attr, '__module__') and attr.__module__.startswith(module_path):
                        classes.append(name)
            except ImportError:
                print(f"Could not import module {mod_path}")
                continue

        # Sort the classes alphabetically and remove duplicates
        classes = sorted(list(set(classes)))

        # Special case for document loaders - prioritize common classes
        if 'document_loaders' in module_path:
            priority_classes = []
            regular_classes = []

            for cls in classes:
                if cls in ['PyPDFLoader', 'TextLoader', 'CSVLoader', 'JSONLoader', 'WebBaseLoader']:
                    priority_classes.append(cls)
                else:
                    regular_classes.append(cls)

            classes = priority_classes + regular_classes

        print(f"Found {len(classes)} classes in {module_path}")

        # Cache the result
        module_classes_cache.set(module_path, classes)

        return jsonify({"classes": classes})
    except ImportError as e:
        return jsonify({"error": f"Could not import {module_path}: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Error scanning classes: {str(e)}"}), 500

@app.route("/api/langchain/class_details", methods=["GET"])
def get_langchain_class_details():
    """Get details about a specific class in LangChain."""
    library = request.args.get("library", "langchain")
    module_path = request.args.get("module", "")
    class_name = request.args.get("class_name", "")

    # Generate cache key
    cache_key = f"{module_path}:{class_name}"

    # Check cache first
    cached_result = class_details_cache.get(cache_key)
    if cached_result:
        print(f"Using cached details for {cache_key}")
        return jsonify(cached_result)

    if not module_path or not class_name:
        return jsonify({"error": "Module and class name are required"}), 400

    try:
        # Import the module
        module = importlib.import_module(module_path)

        # Get the class
        if not hasattr(module, class_name):
            # Try to find the class in a submodule
            class_obj = None

            for submodule_info in pkgutil.iter_modules(module.__path__ if hasattr(module, '__path__') else []):
                submodule_name = f"{module_path}.{submodule_info.name}"
                try:
                    submodule = importlib.import_module(submodule_name)
                    if hasattr(submodule, class_name):
                        class_obj = getattr(submodule, class_name)
                        break
                except ImportError:
                    continue

            if class_obj is None:
                return jsonify({"error": f"Class {class_name} not found in module {module_path}"}), 404
        else:
            class_obj = getattr(module, class_name)

        # Get docstring
        docstring = inspect.getdoc(class_obj) or "No documentation available"

        # Define embedding parameter mappings for fixing parameter names
        embedding_param_mapping = {
            "embed_documents": "texts",
            "embed_query": "text"
        }

        # Special patching for embedding classes to fix parameter names
        is_embedding_class = "embedding" in module_path.lower() or "embed" in class_name.lower()

        # Get methods and patch them if needed
        methods = []
        method_names = []

        for name, method in inspect.getmembers(class_obj, inspect.isfunction):
            # Skip private methods except __init__
            if name.startswith('_') and not name == '__init__':
                continue

            method_names.append(name)

            # Get method signature
            try:
                sig = inspect.signature(method)
                parameters = []

                # Handle special case for embeddings
                if is_embedding_class and name in embedding_param_mapping and "data" in sig.parameters:
                    # Create new parameters dictionary with renamed parameter
                    new_params = {}
                    for param_name, param in sig.parameters.items():
                        if param_name == "data":
                            new_param_name = embedding_param_mapping[name]
                            new_params[new_param_name] = param.replace(
                                name=new_param_name
                            )
                        else:
                            new_params[param_name] = param

                    # Use corrected signature with mapped parameter names
                    sig = sig.replace(parameters=new_params)

                for param_name, param in sig.parameters.items():
                    # Skip self parameter
                    if param_name == 'self':
                        continue

                    # Use the correct parameter name for embeddings
                    if (is_embedding_class and param_name == "data"
                            and name in embedding_param_mapping):
                        param_name = embedding_param_mapping[name]

                    param_info = {
                        "name": param_name,
                        "required": param.default == inspect.Parameter.empty,
                        "default": (str(param.default)
                                   if param.default != inspect.Parameter.empty
                                   else None),
                        "type": (str(param.annotation)
                                if param.annotation != inspect.Parameter.empty
                                else "Any")
                    }
                    parameters.append(param_info)

                method_info = {
                    "name": name,
                    "doc": inspect.getdoc(method) or "No documentation available",
                    "parameters": parameters
                }
                methods.append(method_info)
            except (ValueError, TypeError) as e:
                # Skip methods with invalid signatures
                print(f"Error getting signature for {name}: {str(e)}")
                continue


        # Get init parameters with special handling for document loaders and Pydantic models
        init_params = []

        # Special handling for document loaders - applied before any automatic detection
        is_document_loader = (
            "document_loader" in module_path.lower()
            or "loader" in class_name.lower()
        )

        # Document loader special cases
        if is_document_loader:
            # PyPDFLoader - Override with correct parameters
            if class_name == "PyPDFLoader":
                print(f"Applying override parameters for {class_name}")
                init_params = [
                    {
                        "name": "file_path",
                        "required": True,
                        "default": None,
                        "type": "str"
                    }
                ]
                # Return early to skip automatic parameter detection completely
                class_type = ["DocumentLoader"]
                component_type = "document_loaders"

                # Create result with only the file_path parameter
                result = {
                    "doc": docstring,
                    "methods": method_names,
                    "method_details": methods,
                    "init_params": init_params,
                    "class_type": class_type,
                    "component_type": component_type
                }

                # Cache the result
                class_details_cache.set(cache_key, result)

                return jsonify(result)
            # TextLoader
            elif class_name == "TextLoader":
                init_params = [
                    {
                        "name": "file_path",
                        "required": True,
                        "default": None,
                        "type": "str"
                    },
                    {
                        "name": "encoding",
                        "required": False,
                        "default": "utf-8",
                        "type": "str"
                    }
                ]
                # Return early to skip automatic parameter detection
                class_type = ["DocumentLoader"]
                component_type = "document_loaders"

                result = {
                    "doc": docstring,
                    "methods": method_names,
                    "method_details": methods,
                    "init_params": init_params,
                    "class_type": class_type,
                    "component_type": component_type
                }

                class_details_cache.set(cache_key, result)
                return jsonify(result)
            # CSVLoader
            elif class_name == "CSVLoader":
                init_params = [
                    {
                        "name": "file_path",
                        "required": True,
                        "default": None,
                        "type": "str"
                    },
                    {
                        "name": "csv_args",
                        "required": False,
                        "default": "{}",
                        "type": "dict"
                    }
                ]
                # Return early
                class_type = ["DocumentLoader"]
                component_type = "document_loaders"

                result = {
                    "doc": docstring,
                    "methods": method_names,
                    "method_details": methods,
                    "init_params": init_params,
                    "class_type": class_type,
                    "component_type": component_type
                }

                class_details_cache.set(cache_key, result)
                return jsonify(result)
            # WebBaseLoader
            elif class_name == "WebBaseLoader":
                init_params = [
                    {
                        "name": "web_paths",
                        "required": True,
                        "default": None,
                        "type": "List[str]"
                    }
                ]
                # Return early
                class_type = ["DocumentLoader"]
                component_type = "document_loaders"

                result = {
                    "doc": docstring,
                    "methods": method_names,
                    "method_details": methods,
                    "init_params": init_params,
                    "class_type": class_type,
                    "component_type": component_type
                }

                class_details_cache.set(cache_key, result)
                return jsonify(result)

        # If we get here, proceed with automatic parameter detection
        try:
            init_sig = inspect.signature(class_obj.__init__)

            # Check if this might be a Pydantic model
            has_pydantic_structure = '**data' in str(init_sig) or 'kwargs' in str(init_sig)

            if has_pydantic_structure:
                # Try different ways to get fields for potential Pydantic models
                field_parameters = []

                # Try to create an instance to inspect its fields
                try:
                    # Attempt to instantiate without required args (may fail)
                    instance = class_obj()
                    # Get fields from the instance
                    for field_name in dir(instance):
                        if not field_name.startswith('_') and not callable(getattr(instance, field_name)):
                            field_parameters.append({
                                "name": field_name,
                                "required": False,  # can't easily determine this
                                "default": "None",
                                "type": "Any"
                            })
                except:
                    pass

                # Try Pydantic v1
                if not field_parameters and hasattr(class_obj, '__fields__'):
                    for field_name, field in class_obj.__fields__.items():
                        field_parameters.append({
                            "name": field_name,
                            "required": field.required if hasattr(field, 'required') else False,
                            "default": str(field.default) if hasattr(field, 'default') else "None",
                            "type": str(field.type_) if hasattr(field, 'type_') else "Any"
                        })
                    print(f"Found Pydantic v1 fields: {[p['name'] for p in field_parameters]}")

                # Try Pydantic v2
                if not field_parameters and hasattr(class_obj, 'model_fields'):
                    for field_name, field in class_obj.model_fields.items():
                        field_parameters.append({
                            "name": field_name,
                            "required": not hasattr(field, 'default') or field.default is None,
                            "default": str(field.default) if hasattr(field, 'default') else "None",
                            "type": str(field.annotation) if hasattr(field, 'annotation') else "Any"
                        })
                    print(f"Found Pydantic v2 fields: {[p['name'] for p in field_parameters]}")

                # Try __annotations__ as a fallback
                if not field_parameters and hasattr(class_obj, '__annotations__'):
                    for field_name, type_hint in class_obj.__annotations__.items():
                        field_parameters.append({
                            "name": field_name,
                            "required": True,  # assume required since we can't tell
                            "default": "None",
                            "type": str(type_hint)
                        })
                    print(f"Found annotations: {[p['name'] for p in field_parameters]}")

                # Look at constructor parameters through source code inspection as last resort
                if not field_parameters:
                    try:
                        source = inspect.getsource(class_obj.__init__)
                        # Look for self.XXX = XXX patterns in constructor
                        import re
                        matches = re.findall(r'self\.([a-zA-Z0-9_]+)\s*=', source)
                        if matches:
                            for field_name in matches:
                                field_parameters.append({
                                    "name": field_name,
                                    "required": False,  # assume not required
                                    "default": "None",
                                    "type": "Any"
                                })
                            print(f"Found fields via source inspection: {[p['name'] for p in field_parameters]}")
                    except:
                        pass

                if field_parameters:
                    init_params = field_parameters
                    print(f"Using dynamic field inspection for {class_name}: {len(field_parameters)} fields found")

            # If no fields found from Pydantic-style inspection, use regular signature inspection
            if not init_params:
                # Check if we have special parameter handling for this class
                if is_document_loader and special_init_params is not None:
                    init_params = special_init_params
                    print(f"Using special parameter handling for {class_name}")
                else:
                    for param_name, param in init_sig.parameters.items():
                        # Skip self parameter
                        if param_name == 'self':
                            continue

                        param_info = {
                            "name": param_name,
                            "required": param.default == inspect.Parameter.empty,
                            "default": str(param.default) if param.default != inspect.Parameter.empty else None,
                            "type": str(param.annotation) if param.annotation != inspect.Parameter.empty else "Any"
                        }
                        init_params.append(param_info)
        except (ValueError, TypeError) as e:
            print(f"Error getting init parameters for {class_name}: {str(e)}")

        # Get class inheritance to determine type
        class_type = []
        try:
            for base in class_obj.__mro__[1:]:  # Skip the class itself
                if base.__module__.startswith('langchain'):
                    class_type.append(base.__name__)
        except Exception as e:
            print(f"Error getting class inheritance: {str(e)}")

        # Add common methods for component types if they aren't already in methods
        component_type = ""
        if "document_loaders" in module_path: component_type = "document_loaders"
        elif "text_splitters" in module_path: component_type = "text_splitters"
        elif "embedding" in module_path or "embed" in class_name.lower(): component_type = "embeddings"
        elif "vectorstore" in module_path: component_type = "vectorstores"
        elif "retriever" in module_path: component_type = "retrievers"
        elif "llm" in module_path: component_type = "llms"
        elif "chat" in module_path: component_type = "chat_models"
        elif "chain" in module_path: component_type = "chains"

        # Map of component types to their most commonly used methods
        common_methods = {
            "document_loaders": ["load"],
            "text_splitters": ["split_documents"],
            "embeddings": ["embed_documents", "embed_query"],
            "vectorstores": ["similarity_search", "from_documents"],
            "retrievers": ["get_relevant_documents"],
            "llms": ["invoke", "generate"],
            "chat_models": ["invoke", "generate"],
            "chains": ["invoke", "run"]
        }

        # Check if we should add common methods that may have been missed
        if component_type in common_methods:
            for method_name in common_methods[component_type]:
                if method_name not in method_names:
                    # Try to see if method exists but wasn't captured
                    if hasattr(class_obj, method_name):
                        try:
                            method = getattr(class_obj, method_name)
                            sig = inspect.signature(method)
                            parameters = []

                            for param_name, param in sig.parameters.items():
                                if param_name == 'self':
                                    continue

                                param_info = {
                                    "name": param_name,
                                    "required": param.default == inspect.Parameter.empty,
                                    "default": str(param.default) if param.default != inspect.Parameter.empty else None,
                                    "type": str(param.annotation) if param.annotation != inspect.Parameter.empty else "Any"
                                }
                                parameters.append(param_info)

                            method_info = {
                                "name": method_name,
                                "doc": inspect.getdoc(method) or "No documentation available",
                                "parameters": parameters
                            }
                            methods.append(method_info)
                            method_names.append(method_name)
                            print(f"Added common method {method_name} for {component_type}")
                        except Exception as e:
                            print(f"Error adding common method {method_name}: {str(e)}")

        result = {
            "doc": docstring,
            "methods": method_names,
            "method_details": methods,
            "init_params": init_params,
            "class_type": class_type,
            "component_type": component_type
        }

        # Cache the result
        class_details_cache.set(cache_key, result)

        return jsonify(result)
    except ImportError as e:
        return jsonify({"error": f"Could not import {module_path}: {str(e)}"}), 400
    except Exception as e:
        error_traceback = traceback.format_exc()
        print(f"Error getting class details: {error_traceback}")
        return jsonify({"error": f"Error getting class details: {str(e)}"}), 500

@app.route("/api/blocks/create_custom", methods=["POST"])
def create_custom_block():
    """Create a custom block based on a LangChain class."""
    data = request.json
    module_path = data.get("module_path")
    class_name = data.get("class_name")
    block_id = data.get("id")
    methods = data.get("methods", [])
    input_nodes = data.get("input_nodes", [])
    output_nodes = data.get("output_nodes", [])
    parameters = data.get("parameters", {})

    if not module_path or not class_name or not block_id:
        return jsonify({"error": "Missing required parameters"}), 400

    # Create a custom block class dynamically
    try:
        # Generate import string
        import_string = f"import {module_path}"

        # Generate function string based on selected methods
        function_parts = [f"def create_{class_name.lower()}({', '.join([p for p in parameters])}):",
                         f"    instance = {module_path}.{class_name}({', '.join([f'{k}={k}' for k in parameters])})",
                         "    return instance"]

        # Add additional method calls if provided
        for method in methods:
            if method != "__init__":  # Skip __init__ as it's handled in the instantiation
                method_params = data.get(f"params_{method}", {})
                param_str = ", ".join([f"{k}={v}" for k, v in method_params.items()])
                function_parts.append(f"    # Call {method} method")
                function_parts.append(f"    result = instance.{method}({param_str})")
                function_parts.append(f"    return result")

        function_string = "\n".join(function_parts)

        # Create a Block subclass dynamically
        class CustomBlock(Block):
            def __init__(self):
                super().__init__()
                self.import_string = import_string
                self.function_string = function_string
                self.input_nodes = input_nodes
                self.output_nodes = output_nodes
                self.parameters = parameters
                self.methods = methods
                self.class_name = class_name
                self.module_path = module_path

            def validate_connections(self) -> bool:
                # Basic validation - could be enhanced based on specific requirements
                return True

        # Add the custom block to the canvas
        canvas.add_block(block_id, CustomBlock())

        return jsonify({
            "status": "success",
            "message": f"Created custom block for {class_name}",
            "block_id": block_id,
            "input_nodes": input_nodes,
            "output_nodes": output_nodes
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Just print status instead of enforcing Ollama to run
    ensure_ollama_is_running()
    canvas.clear()  # Clear the canvas to prevent custom blocks from persisting
    app.run(debug=True)
