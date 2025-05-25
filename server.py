from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_cors import CORS
from flask_login import current_user
import importlib
import inspect
import pkgutil
import traceback
from blocks import Canvas, Block
from extensions import login_manager, init_app
from models import AdminPanel, User
from auth import auth as auth_blueprint
from admin import admin as admin_blueprint

import os
import logging

log = logging.getLogger("werkzeug")  # Suppress werkzeug logging
log.setLevel(logging.ERROR)

print("Probably running on http://127.0.0.1:5000")

app = Flask(__name__, static_folder="static", template_folder="static/html")
CORS(app)

# Configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-key-please-change")

# Determine default database URI
if "DATABASE_URL" in os.environ:
    # Use DATABASE_URL if it's set (primarily for Docker)
    default_db_uri = os.environ.get("DATABASE_URL")
else:
    # For local execution, construct an absolute path
    # IS_DOCKER check is mostly for clarity, DATABASE_URL should be set in Docker
    if os.environ.get("IS_DOCKER") == "true":
        # This path is for consistency if somehow IS_DOCKER is true but DATABASE_URL is not.
        default_db_uri = "sqlite:////app/instance/app.db"
    else:
        # Local execution: construct absolute path relative to server.py
        project_root_server = os.path.dirname(os.path.abspath(__file__))
        instance_folder_server = os.path.join(project_root_server, "instance")
        db_abs_path_server = os.path.join(instance_folder_server, "app.db")
        # Construct the URI carefully to avoid f-string backslash issues
        default_db_uri = "sqlite:///" + db_abs_path_server.replace("\\", "/")
        print(f"SERVER.PY (Local): Using DB URI: {default_db_uri}")

app.config["SQLALCHEMY_DATABASE_URI"] = default_db_uri
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", True)
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD")

# Initialize extensions
init_app(app)


@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))


# Register blueprints
app.register_blueprint(auth_blueprint)
app.register_blueprint(admin_blueprint, url_prefix="/admin")

# Global canvas instance
canvas = Canvas()

# Dictionary to store block connections and their associated functions
block_connections = {}


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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/connect", methods=["POST"])
def connect_blocks():
    data = request.json
    source_id = data.get("source")
    target_id = data.get("target")
    input_id = data.get("inputId")
    print("\n\nTHIS IS BEING USED")
    # Store the connectio
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


@app.route("/api/blocks/create", methods=["POST"])
def create_block():
    data = request.json
    block_type = data.get("type")
    block_id = data.get("id")

    if not block_type or not block_id:
        return jsonify({"error": "Missing block type or ID"}), 400

    return (
        jsonify({"error": "Invalid block type. Only custom blocks are allowed."}),
        400,
    )


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
    output_file = data.get("output_file", "generated_pipeline.py")
    blocks_data = data.get("blocks", {})
    connections_data = data.get("connections", [])  # Array of connection objects
    print("\nconnections:", connections_data, "\n")
    try:
        # Create a temporary Canvas with the blocks from the request
        temp_canvas = Canvas()

        # Add blocks from the request
        for block_id, block_info in blocks_data.items():
            block_type = block_info.get("type")
            config = block_info.get("config", {})

            # Create a custom block instance
            class CustomPipelineBlock(Block):
                def __init__(self):
                    super().__init__()
                    self.block_type = block_type
                    self.class_name = None
                    self.module_path = ""
                    self.config = config
                    self.component_type = ""
                    self.selected_methods = []
                    self.parameters = {}
                    self.static_methods = []
                    self.class_methods = []

                    # Handle late initialization setting
                    self.late_initialization = config.get("late_initialization", False)

                    # Special handling for Godpromptblock
                    if block_type == "godprompt":
                        self.class_name = "GodpromptBlock"
                        self.component_type = "prompt_formatter"
                        self.selected_methods = ["format_prompt"]
                        self.methods = ["format_prompt"]
                        self.import_string = (
                            "# Custom Godpromptblock - no imports needed"
                        )

                        # Get parameters from config
                        prompt_text = config.get("prompt", "Enter your prompt here...")
                        question_text = config.get(
                            "question", "Enter your question here..."
                        )

                        # Generate the class definition directly in the function string
                        self.function_string = f'''
class GodpromptBlock:
    """Custom prompt formatting block that combines context, prompt, and question."""
    
    def __init__(self, prompt="{prompt_text}", question="{question_text}"):
        self.prompt = prompt
        self.question = question
    
    def format_prompt(self, context, prompt=None, question=None):
        """Format the prompt using context, prompt, and question."""
        if prompt is None:
            prompt = self.prompt
        if question is None:
            question = self.question
        
        # Combine everything into a formatted string
        formatted_prompt = f\"\"\"Context: {{context}}

Prompt: {{prompt}}

Question: {{question}}\"\"\"
        
        return formatted_prompt
'''
                        # Set parameters for the method
                        self.parameters = {
                            "format_prompt": [
                                {"name": "context", "required": True, "type": "str"},
                                {
                                    "name": "prompt",
                                    "required": False,
                                    "type": "str",
                                    "default": prompt_text,
                                },
                                {
                                    "name": "question",
                                    "required": False,
                                    "type": "str",
                                    "default": question_text,
                                },
                            ]
                        }

                    # Extract module path and class name from block_type for regular custom blocks
                    elif block_type.startswith("custom_"):
                        # Remove 'custom_' prefix to get the full class path
                        full_class_path = block_type[
                            7:
                        ]  # e.g. "langchain_community.llms.OpenAI"

                        # Split the path to get module and class name
                        parts = full_class_path.split(".")
                        if len(parts) > 1:
                            self.class_name = parts[-1]  # Last part is class name
                            self.module_path = ".".join(
                                parts[:-1]
                            )  # Rest is module path

                            # Set import string for custom classes
                            self.import_string = (
                                f"from {self.module_path} import {self.class_name}"
                            )
                            print(f"Custom block import: {self.import_string}")
                        else:
                            self.class_name = full_class_path  # If no dots, use as is
                            self.import_string = f"# Import for {self.class_name}"

                        # Determine component type based on module path and class name
                        if (
                            "document_loaders" in self.module_path
                            or "loader" in self.class_name.lower()
                        ):
                            self.component_type = "document_loaders"
                        elif "text_splitters" in self.module_path:
                            self.component_type = "text_splitters"
                        elif (
                            "embedding" in self.module_path
                            or "embed" in self.class_name.lower()
                        ):
                            self.component_type = "embeddings"
                        elif "vectorstore" in self.module_path:
                            self.component_type = "vectorstores"
                        elif "retriever" in self.module_path:
                            self.component_type = "retrievers"
                        elif "llm" in self.module_path:
                            self.component_type = "llms"
                        elif "chat" in self.module_path:
                            self.component_type = "chat_models"
                        elif "chain" in self.module_path:
                            self.component_type = "chains"
                        else:
                            # Default to a generic type
                            self.component_type = "error"

                        self.function_string = (
                            f"# Placeholder for {self.class_name} function"
                        )

                    # Extract methods from block info or config (for regular custom blocks)
                    if block_type != "godprompt":
                        if "methods" in config:
                            self.selected_methods = config["methods"]
                        elif "selected_methods" in config:
                            self.selected_methods = config["selected_methods"]
                        elif "selected_methods" in config.get("config", {}):
                            self.selected_methods = config["config"]["selected_methods"]

                        # Extract static and class methods information
                        if "static_methods" in config:
                            self.static_methods = config["static_methods"]
                        elif "static_methods" in config.get("config", {}):
                            self.static_methods = config["config"]["static_methods"]

                        if "class_methods" in config:
                            self.class_methods = config["class_methods"]
                        elif "class_methods" in config.get("config", {}):
                            self.class_methods = config["config"]["class_methods"]

                        # Look for a selected method that might not be in the methods list yet
                        selected_method = None
                        if "selected_method" in config:
                            selected_method = config["selected_method"]
                        elif "selected_method" in config.get("config", {}):
                            selected_method = config["config"]["selected_method"]

                        # If we have a selected method but it's not in our list yet, add it
                        if selected_method and (
                            not self.selected_methods
                            or selected_method not in self.selected_methods
                        ):
                            if not self.selected_methods:
                                self.selected_methods = [selected_method]
                            else:
                                self.selected_methods.append(selected_method)

                        # Create placeholder for methods list (all available methods)
                        self.methods = (
                            list(self.selected_methods) if self.selected_methods else []
                        )

                        # Always add __init__ to methods if not present
                        if "__init__" not in self.methods:
                            self.methods.append("__init__")

                        # Create default parameters for methods
                        for method in self.methods:
                            self.parameters[method] = []

                    # Extract method-specific parameters
                    if "method_parameters" in config:
                        self.method_parameters = config["method_parameters"]
                    else:
                        self.method_parameters = {}

                def validate_connections(self) -> bool:
                    return True

            temp_canvas.add_block(block_id, CustomPipelineBlock())

        # Now, for special connections between blocks with specific method nodes
        reverse_connection_map = {}
        method_connection_map = {}  # Maps block_id -> input_node -> source blocks

        # Create a plain connections dict format for execution order
        canvas_connections = {}
        for conn in connections_data:
            source_id = conn.get("source")
            target_id = conn.get("target")

            if (
                source_id
                and target_id
                and source_id in temp_canvas.blocks
                and target_id in temp_canvas.blocks
            ):
                if source_id not in canvas_connections:
                    canvas_connections[source_id] = []
                if target_id not in canvas_connections[source_id]:
                    canvas_connections[source_id].append(target_id)

        # Determine execution order
        execution_order = determine_execution_order(
            temp_canvas.blocks, canvas_connections
        )

        # Initialize connection maps
        for block_id in execution_order:
            if block_id not in reverse_connection_map:
                reverse_connection_map[block_id] = []

            if block_id not in method_connection_map:
                method_connection_map[block_id] = {}

        # Build reverse connection map
        for source_id, targets in canvas_connections.items():
            for target_id in targets:
                if target_id not in reverse_connection_map:
                    reverse_connection_map[target_id] = []

                if source_id not in reverse_connection_map[target_id]:
                    reverse_connection_map[target_id].append(source_id)

        # Add a debug print to see what's in connections_data
        print("\nDEBUG - All connection details:")
        for conn in connections_data:
            print(f"Connection: {conn}")

        # Create a more robust method_connection_map
        method_connection_map = (
            {}
        )  # Maps block_id -> input_method -> source blocks and methods

        # Initialize for all blocks
        for block_id in execution_order:
            method_connection_map[block_id] = {}

        # Process each connection to build the method map
        for conn in connections_data:
            source_id = conn.get("source")
            target_id = conn.get("target")
            input_id = conn.get("inputId", "")
            source_node = conn.get("sourceNode", "")
            source_method = conn.get("sourceMethod", "")

            # Skip if missing required data
            if not source_id or not target_id or not input_id:
                continue

            # Get the target method from the input_id
            if "_input" in input_id:
                target_method = input_id.split("_input")[0]
            else:
                target_method = "default"

            # Get source method from sourceNode or sourceMethod
            if not source_method and source_node and "_output" in source_node:
                source_method = source_node.split("_output")[0]

            # Make sure the target block exists in our map
            if target_id not in method_connection_map:
                method_connection_map[target_id] = {}

            # Make sure the target method exists in the block's map
            if target_method not in method_connection_map[target_id]:
                method_connection_map[target_id][target_method] = []

            # Add the source with its method
            method_connection_map[target_id][target_method].append(
                {"block_id": source_id, "method": source_method}
            )

        # Print the method connection map for debugging
        print("\nDEBUG - Method connection map:")
        for target_id, methods in method_connection_map.items():
            print(f"Target {target_id}:")
            for method, sources in methods.items():
                print(f"  Method {method}: {sources}")

        # Set the connections on the temp canvas - use the standard format for compatibility
        temp_canvas.connections = canvas_connections

        # Define the output file path
        temp_file = output_file

        # Export the code - using custom export logic similar to block_sim.py
        generated_code = generate_python_code(
            temp_canvas.blocks,
            temp_canvas.connections,
            method_connection_map,
            connections_data,
        )

        # Write the generated code to the file
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(generated_code)

        # Return the code as part of the response
        return jsonify(
            {
                "status": "success",
                "message": "Successfully generated Python code",
                "code": generated_code,
                "file": output_file,
            }
        )
    except Exception as e:
        print(f"Export error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def generate_python_code(
    blocks, connections, method_connections=None, connections_data=None
):
    """Generate Python code for blocks and connections with late initialization support."""
    # Determine execution order
    execution_order = determine_execution_order(blocks, connections)

    # Initialize collections
    imports = set()
    imports.add("import os")
    init_code_lines = []
    method_code_lines = []

    # Check if we need to create files directory
    has_file_paths = False

    # Track blocks that have already been initialized with special handling
    special_init_blocks = set()

    # Track blocks with late initialization enabled
    late_init_blocks = set()

    # Track which blocks have been initialized (for late init)
    initialized_blocks = set()

    # First scan to collect all imports upfront and identify late init blocks
    for block_id, block in blocks.items():
        # Check for late initialization setting
        if (
            hasattr(block, "config")
            and block.config
            and block.config.get("late_initialization", False)
        ):
            late_init_blocks.add(block_id)
            print(f"Block {block_id} marked for late initialization")

        # Collect imports
        if (
            hasattr(block, "import_string")
            and block.import_string
            and not block.import_string.startswith("#")
        ):
            if not (
                block.import_string
                == "from custom_blocks.prompt_templates import GodpromptBlock"
            ):
                imports.add(block.import_string)
        elif (
            hasattr(block, "module_path")
            and block.module_path
            and hasattr(block, "class_name")
        ):
            import_statement = f"from {block.module_path} import {block.class_name}"
            imports.add(import_statement)

        # Check if this block uses file paths
        if hasattr(block, "config") and block.config:
            if "parameters" in block.config and isinstance(
                block.config["parameters"], dict
            ):
                for param_name, param_value in block.config["parameters"].items():
                    if isinstance(param_value, str) and "files/" in param_value:
                        has_file_paths = True
                        break

    # Create variable names for each block
    block_vars = {}
    for i, block_id in enumerate(execution_order):
        block = blocks[block_id]
        class_name = (
            block.class_name if hasattr(block, "class_name") else type(block).__name__
        )
        var_name = f"{class_name.lower()}_{i+1}".replace(" ", "_").replace("-", "_")
        block_vars[block_id] = var_name

    # Build connection maps for easier processing
    connection_map = {}
    reverse_connection_map = {}

    for source_id, targets in connections.items():
        if source_id not in connection_map:
            connection_map[source_id] = []
        for target_id in targets:
            connection_map[source_id].append(target_id)
            if target_id not in reverse_connection_map:
                reverse_connection_map[target_id] = []
            reverse_connection_map[target_id].append(source_id)

    # Function to get method-specific parameters for a block
    def get_method_parameters(block, method_name):
        """Extract parameters that belong to a specific method."""
        method_params = []

        if not hasattr(block, "config") or not block.config:
            return method_params
        
        print(f"DEBUG: Getting method parameters for {method_name} on block with component_type: {getattr(block, 'component_type', 'None')}")
        print(f"DEBUG: Block config: {block.config}")
        print(f"DEBUG: Block has component_type attr: {hasattr(block, 'component_type')}")

        # First check for method-specific parameters in method_parameters
        if "method_parameters" in block.config and isinstance(block.config["method_parameters"], dict):
            if method_name in block.config["method_parameters"]:
                method_specific_params = block.config["method_parameters"][method_name]
                for param_name, param_value in method_specific_params.items():
                    if param_value == "":
                        continue
                    
                    # Format the parameter value
                    if isinstance(param_value, str) and not (
                        param_value.startswith(
                            ("'", '"', "[", "{", "True", "False", "None")
                        )
                        or param_value.isdigit()
                    ):
                        param_value = f'"{param_value}"'
                    method_params.append(f"{param_name}={param_value}")

        # For ALL blocks, check if there are parameters in the general parameters
        # that should belong to this specific method but aren't in method_parameters yet
        if "parameters" in block.config:
            for param_name, param_value in block.config["parameters"].items():
                if param_value == "":
                    continue

                # Skip if this parameter was already added from method_parameters
                if any(param.startswith(f"{param_name}=") for param in method_params):
                    continue

                # Check if this parameter should belong to this method
                should_add_param = False
                
                # For vectorstore search methods, add query parameter
                if (param_name == "query" and method_name in ["similarity_search", "search", "similarity_search_with_score"]
                    and hasattr(block, "component_type") and block.component_type == "vectorstores"):
                    should_add_param = True
                    print(f"DEBUG: Adding query parameter to {method_name} method for ALL blocks")
                
                # For late init blocks, be more permissive with other parameters
                elif block_id in late_init_blocks and method_name != "__init__" and param_name != "query":
                    should_add_param = True
                
                if should_add_param:
                    # Format the parameter value
                    if isinstance(param_value, str) and not (
                        param_value.startswith(
                            ("'", '"', "[", "{", "True", "False", "None")
                        )
                        or param_value.isdigit()
                    ):
                        param_value = f'"{param_value}"'
                    method_params.append(f"{param_name}={param_value}")



        print(f"DEBUG: Final method params for {method_name}: {method_params}")
        return method_params

    # Function to initialize a block (used for both regular and late initialization)
    def initialize_block(block_id, block, var_name, class_name):
        if block_id in initialized_blocks:
            return  # Already initialized

        # Build initialization parameters
        init_params = []

        if hasattr(block, "config") and block.config:

            # For late init blocks, only include parameters that are specifically for __init__
            # For regular blocks, include all parameters
            if "parameters" in block.config and isinstance(
                block.config["parameters"], dict
            ):
                for param_name, param_value in block.config["parameters"].items():
                    # For late init blocks, skip parameters that belong to methods
                    if block_id in late_init_blocks:
                        # Only include parameters that are explicitly for __init__
                        # In this simplified version, we assume late init blocks don't need init params
                        # unless they're specifically marked as __init__ parameters
                        continue

                    # Skip empty string values
                    if param_value == "":
                        continue

                    # Skip parameters that are method-specific (stored in method_parameters)
                    if "method_parameters" in block.config:
                        is_method_param = False
                        for method_name, method_params in block.config["method_parameters"].items():
                            if method_name != "__init__" and param_name in method_params:
                                is_method_param = True
                                break
                        if is_method_param:
                            continue
                    
                    # Also check if this parameter name is commonly a method parameter (not init parameter)
                    # For vectorstores like Chroma, 'query' is typically for search methods, not initialization
                    if (hasattr(block, "component_type") and block.component_type == "vectorstores" 
                        and param_name == "query"):
                        continue

                    # Format the value properly (existing logic)
                    if isinstance(param_value, str):
                        if "files/" in param_value:
                            # If there are multiple comma-separated paths, handle each one
                            file_paths = [
                                path.strip() for path in param_value.split(",")
                            ]
                            formatted_paths = []

                            for path in file_paths:
                                if path.startswith("files/"):
                                    # Make path relative to the files directory
                                    formatted_paths.append(
                                        f'os.path.normpath(os.path.join("files", "{os.path.basename(path)}"))'
                                    )
                                elif not (
                                    path.startswith(
                                        ("'", '"', "[", "{", "True", "False", "None")
                                    )
                                    or path.isdigit()
                                ):
                                    formatted_paths.append(f'"{path}"')
                                else:
                                    formatted_paths.append(path)

                            # Join multiple paths if needed
                            if len(formatted_paths) > 1:
                                # For common document loaders, use a list of file paths
                                if (
                                    "document_loaders" in class_name.lower()
                                    or "loader" in class_name.lower()
                                    or hasattr(block, "component_type")
                                    and block.component_type == "document_loaders"
                                ):
                                    param_value = f"[{', '.join(formatted_paths)}]"

                                    # Special handling for specific loaders
                                    if (
                                        param_name == "file_path"
                                        and block_id not in special_init_blocks
                                    ):
                                        # Mark this block as specially initialized
                                        special_init_blocks.add(block_id)

                                        # Add extra code for multi-file loading
                                        multi_load_comment = (
                                            f"# Handle multiple files for {class_name}"
                                        )
                                        init_code_lines.append(multi_load_comment)

                                        # Find next available variable name
                                        i = 1
                                        while f"docs_{i}" in block_vars.values():
                                            i += 1

                                        result_var = f"docs_{i}"

                                        # Generate code to load multiple documents - ensure path normalization
                                        init_code_lines.append(f"{result_var} = []")
                                        # Use raw strings for file paths to avoid issues with Windows backslashes
                                        init_code_lines.append(
                                            "# Normalize paths for cross-platform compatibility"
                                        )
                                        init_code_lines.append(
                                            f"file_paths = [os.path.normpath(p) for p in {param_value}]"
                                        )
                                        init_code_lines.append(
                                            "for file_path in file_paths:"
                                        )
                                        init_code_lines.append(
                                            '    print(f"Loading {file_path}...")'
                                        )
                                        init_code_lines.append("    try:")
                                        init_code_lines.append(
                                            f"        loader = {class_name}(file_path)"
                                        )
                                        init_code_lines.append(
                                            f"        {result_var}.extend(loader.load())"
                                        )
                                        init_code_lines.append(
                                            '        print(f"Successfully loaded {file_path}")'
                                        )
                                        init_code_lines.append(
                                            "    except Exception as e:"
                                        )
                                        init_code_lines.append(
                                            '        print(f"Error loading {file_path}: {e}")'
                                        )

                                        # Store reference to the first file (if available) for compatibility
                                        init_code_lines.append(
                                            "# Create a reference loader with the first file path"
                                        )
                                        init_code_lines.append("if file_paths:")
                                        init_code_lines.append(
                                            f"    {var_name} = {class_name}(file_paths[0])"
                                        )
                                        init_code_lines.append(
                                            f"    {var_name}_output = {result_var}"
                                        )
                                        init_code_lines.append("else:")
                                        init_code_lines.append(
                                            '    print("Warning: No valid file paths provided")'
                                        )

                                        # Skip adding this parameter since we're handling it specially
                                        continue
                                else:
                                    # Default behavior for other parameters with multiple values
                                    param_value = f"[{', '.join(formatted_paths)}]"
                            else:
                                param_value = formatted_paths[0]
                        elif ("embedding") in param_value:
                            param_value = param_value.strip("\"'")
                        elif not (
                            param_value.startswith(
                                ("'", '"', "[", "{", "True", "False", "None")
                            )
                            or param_value.isdigit()
                        ):
                            param_value = f'"{param_value}"'

                    init_params.append(f"{param_name}={param_value}")

        # Add initialization code
        if block_id in late_init_blocks:
            # For late init blocks, add to method_code_lines instead of init_code_lines
            method_code_lines.append(f"# Initialize {class_name} (late initialization)")
            if init_params:
                method_code_lines.append(
                    f"{var_name} = {class_name}({', '.join(init_params)})"
                )
            else:
                method_code_lines.append(f"{var_name} = {class_name}()")
        else:
            # For regular blocks, add to init_code_lines
            init_code_lines.append(f"# Initialize {class_name}")
            if init_params:
                init_code_lines.append(
                    f"{var_name} = {class_name}({', '.join(init_params)})"
                )
            else:
                init_code_lines.append(f"{var_name} = {class_name}()")

        initialized_blocks.add(block_id)

    # Handle regular initialization for non-late-init blocks
    for block_id in execution_order:
        if block_id not in late_init_blocks and block_id not in special_init_blocks:
            block = blocks[block_id]
            var_name = block_vars[block_id]
            class_name = (
                block.class_name
                if hasattr(block, "class_name")
                else type(block).__name__
            )
            initialize_block(block_id, block, var_name, class_name)

    # Track processed methods to avoid duplicates
    processed_methods = {block_id: set() for block_id in blocks}

    # Now generate method execution code for each block
    for block_id in execution_order:
        block = blocks[block_id]
        var_name = block_vars[block_id]
        class_name = (
            block.class_name if hasattr(block, "class_name") else type(block).__name__
        )

        # Get methods for this block (excluding __init__)
        methods_to_execute = []
        if hasattr(block, "config") and block.config:
            if "selected_methods" in block.config and isinstance(
                block.config["selected_methods"], list
            ):
                methods_to_execute = [
                    m for m in block.config["selected_methods"] if m != "__init__"
                ]

        if not methods_to_execute:
            if hasattr(block, "methods"):
                methods_to_execute = [m for m in block.methods if m != "__init__"]
            elif hasattr(block, "selected_methods"):
                methods_to_execute = [
                    m for m in block.selected_methods if m != "__init__"
                ]

        # Make sure we have unique methods
        methods_to_execute = list(dict.fromkeys(methods_to_execute))

        if not methods_to_execute:
            continue

        # For late init blocks, initialize just before first method execution
        if block_id in late_init_blocks and block_id not in initialized_blocks:
            initialize_block(block_id, block, var_name, class_name)

        # Execute methods for this block
        for method_name in methods_to_execute:
            print(f"Generating code for method {method_name} on {class_name}")

            # Handle from_documents method replacement
            if method_name == "from_documents" and block_id in late_init_blocks:
                # For from_documents, we replace the initialization entirely
                method_code_lines.append(
                    f"# Using {class_name}.from_documents instead of initialization"
                )

                # Get method-specific parameters
                method_params = get_method_parameters(block, method_name)

                # Get source parameters from connections
                source_params = []
                if method_connections and block_id in method_connections:
                    if method_name in method_connections[block_id]:
                        method_specific_sources = method_connections[block_id][
                            method_name
                        ]
                        for source_info in method_specific_sources:
                            source_id = source_info["block_id"]
                            source_method = source_info["method"]
                            source_var = block_vars[source_id]
                            if source_method:
                                source_params.append(
                                    f"{source_var}_{source_method}_output"
                                )
                            else:
                                source_params.append(f"{source_var}_output")

                # Combine source params and method params
                all_params = source_params + method_params

                # Generate from_documents call
                if all_params:
                    method_code_lines.append(
                        f"{var_name} = {class_name}.{method_name}({', '.join(all_params)})"
                    )
                else:
                    method_code_lines.append(
                        f"{var_name} = {class_name}.{method_name}()"
                    )

                # Mark as initialized since from_documents replaces initialization
                initialized_blocks.add(block_id)
                continue

            # Regular method execution logic
            # Check if we should use method-specific connections
            should_use_method_connections = False
            method_specific_sources = []

            if method_connections and block_id in method_connections:
                if method_name in method_connections[block_id]:
                    should_use_method_connections = True
                    method_specific_sources = method_connections[block_id][method_name]

            source_params = []
            if should_use_method_connections and method_specific_sources:
                for source_info in method_specific_sources:
                    source_id = source_info["block_id"]
                    source_method = source_info["method"]
                    source_var = block_vars[source_id]
                    if source_method:
                        source_params.append(f"{source_var}_{source_method}_output")
                    else:
                        source_params.append(f"{source_var}_output")

            # Get method-specific parameters for ALL blocks
            method_params = get_method_parameters(block, method_name)

            # Combine source params and method params
            all_params = source_params + method_params

            # Determine the method type to generate appropriate call syntax
            method_is_static = False
            method_is_classmethod = False

            if hasattr(block, "config") and block.config:
                static_methods = block.config.get("static_methods", [])
                class_methods = block.config.get("class_methods", [])
                method_is_static = method_name in static_methods
                method_is_classmethod = method_name in class_methods

            # Generate method call
            if all_params:
                filtered_params = [p for p in all_params if p and p.strip() != ""]
                if method_is_static:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {class_name}.{method_name}({', '.join(filtered_params)})"
                    )
                elif method_is_classmethod:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {class_name}.{method_name}({', '.join(filtered_params)})"
                    )
                else:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {var_name}.{method_name}({', '.join(filtered_params)})"
                    )
            else:
                if method_is_static:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {class_name}.{method_name}()"
                    )
                elif method_is_classmethod:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {class_name}.{method_name}()"
                    )
                else:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {var_name}.{method_name}()"
                    )

            processed_methods[block_id].add(method_name)

    # Collect clean lines for the final code
    clean_code_lines = []

    # Check if we have any Godpromptblocks to include the class definition
    has_godpromptblock = False
    for block_id, block in blocks.items():
        if hasattr(block, "class_name") and block.class_name == "GodpromptBlock":
            has_godpromptblock = True
            break

    # Add imports at the top
    clean_code_lines.append("# Imports")
    for imp in sorted(list(imports)):
        if not imp.startswith("# Custom Godpromptblock"):
            clean_code_lines.append(imp)
    clean_code_lines.append("")

    # Add GodpromptBlock class definition if needed
    if has_godpromptblock:
        clean_code_lines.append("# Custom GodpromptBlock class definition")
        clean_code_lines.append("class GodpromptBlock:")
        clean_code_lines.append(
            '    """Custom prompt formatting block that combines context, prompt, and question."""'
        )
        clean_code_lines.append("    ")
        clean_code_lines.append(
            "    def __init__(self, prompt='Enter your prompt here...', question='Enter your question here...'):"
        )
        clean_code_lines.append("        self.prompt = prompt")
        clean_code_lines.append("        self.question = question")
        clean_code_lines.append("    ")
        clean_code_lines.append(
            "    def format_prompt(self, context, prompt=None, question=None):"
        )
        clean_code_lines.append(
            '        """Format the prompt using context, prompt, and question."""'
        )
        clean_code_lines.append("        if prompt is None:")
        clean_code_lines.append("            prompt = self.prompt")
        clean_code_lines.append("        if question is None:")
        clean_code_lines.append("            question = self.question")
        clean_code_lines.append("        ")
        clean_code_lines.append("        # Combine everything into a formatted string")
        clean_code_lines.append('        formatted_prompt = f"""Context: {context}')
        clean_code_lines.append("")
        clean_code_lines.append("Prompt: {prompt}")
        clean_code_lines.append("")
        clean_code_lines.append('Question: {question}"""')
        clean_code_lines.append("        ")
        clean_code_lines.append("        return formatted_prompt")
        clean_code_lines.append("")

    # Add files directory creation if needed
    if has_file_paths:
        clean_code_lines.append("# Create files directory if it doesn't exist")
        clean_code_lines.append("os.makedirs('files', exist_ok=True)")
        clean_code_lines.append("")

    # Add initialization code
    clean_code_lines.append("# Initialize components")
    clean_code_lines.extend(init_code_lines)
    clean_code_lines.append("")

    # Add method calls
    clean_code_lines.append("# Process data through the pipeline")
    clean_code_lines.extend(method_code_lines)
    clean_code_lines.append("")

    # Add final print for the last block
    if execution_order:
        last_block_id = execution_order[-1]
        last_var = block_vars[last_block_id]
        last_block = blocks[last_block_id]
        last_class = (
            last_block.class_name
            if hasattr(last_block, "class_name")
            else type(last_block).__name__
        )

        # Find the last method executed
        last_method = None
        if hasattr(last_block, "config") and last_block.config:
            if "selected_methods" in last_block.config:
                methods = [
                    m for m in last_block.config["selected_methods"] if m != "__init__"
                ]
                if methods:
                    last_method = methods[-1]

        clean_code_lines.append("# Print the final result")
        clean_code_lines.append(f'print("\\nFinal result from {last_class}:")')
        if last_method:
            clean_code_lines.append(f"print({last_var}_{last_method}_output)")
        else:
            clean_code_lines.append(f"print({last_var})")

    # Generate the final code
    final_code = []
    for line in clean_code_lines:
        final_code.append(line)

    return "\n".join(final_code)


def determine_execution_order(blocks, connections):
    """Determine the order in which blocks should be executed using topological sort."""
    # Calculate in-degree for each block
    in_degree = {block_id: 0 for block_id in blocks}
    for source_id, targets in connections.items():
        for target_id in targets:
            in_degree[target_id] = in_degree.get(target_id, 0) + 1

    # Start with blocks that have no incoming edges
    queue = [block_id for block_id, degree in in_degree.items() if degree == 0]
    execution_order = []

    # Process queue
    while queue:
        current = queue.pop(0)
        execution_order.append(current)

        # Reduce in-degree of neighbors
        if current in connections:
            for neighbor in connections[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

    # If we couldn't resolve all blocks, handle cycles by adding remaining blocks
    if len(execution_order) < len(blocks):
        for block_id in blocks:
            if block_id not in execution_order:
                execution_order.append(block_id)

    return execution_order


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

        # Check if the block exists in the canvas
        block = canvas.blocks.get(block_id)

        if block:
            # Use the canvas block implementation
            result = canvas.process_block(block_id, config)
            print(f"[COMPLETED] Block: {block_type} completed")
            return jsonify(result)
        else:
            # Handle custom block processing through the custom block API
            return jsonify(
                {
                    "status": "error",
                    "output": f"Block not found or not implemented: {block_type}",
                    "block_id": block_id,
                }
            )
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
        "langchain_text_splitters",
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
        # Special case for langchain_text_splitters which has classes at root level
        if library == "langchain_text_splitters":
            # Return the library itself as the only "module"
            return jsonify({"modules": [library]})

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
        return jsonify({"classes": cached_result})

    try:
        # Special case for langchain_text_splitters
        if module_path == "langchain_text_splitters":
            # Import the module
            module = importlib.import_module(module_path)
            classes = []

            # Get all attributes in the module that are classes
            for name, attr in inspect.getmembers(module, inspect.isclass):
                # Skip private attributes
                if name.startswith("_"):
                    continue

                # Make sure it's from the langchain_text_splitters module
                if hasattr(attr, "__module__") and attr.__module__.startswith(
                    module_path
                ):
                    classes.append(name)

            # Sort and cache the results
            classes = sorted(classes)
            module_classes_cache.set(module_path, classes)
            return jsonify({"classes": classes})

        # Import the base package
        module = importlib.import_module(module_path)
        classes = []

        # First, try to get all submodules if this is a package
        submodules = []
        try:
            # Check if module has __path__ attribute (indicating it's a package)
            if hasattr(module, "__path__"):
                # Get all modules in the package (both modules and packages)
                for finder, name, ispkg in pkgutil.iter_modules(module.__path__):
                    submodule_name = f"{module_path}.{name}"
                    submodules.append(submodule_name)

                    # If this is a frequently used module, look deeper
                    if name in [
                        "document_loaders",
                        "embeddings",
                        "llms",
                        "vectorstores",
                    ]:
                        try:
                            sub = importlib.import_module(submodule_name)
                            if hasattr(sub, "__path__"):
                                for (
                                    sub_finder,
                                    sub_name,
                                    sub_ispkg,
                                ) in pkgutil.iter_modules(sub.__path__):
                                    submodules.append(f"{submodule_name}.{sub_name}")
                        except ImportError:
                            pass
        except Exception as e:
            print(f"Error scanning submodules: {str(e)}")

        # Add the module itself to the list of modules to check
        modules_to_check = [module_path] + submodules

        # Check each module for classes
        for mod_path in modules_to_check:
            try:
                mod = importlib.import_module(mod_path)

                # Get all attributes in the module that are classes
                for name, attr in inspect.getmembers(mod, inspect.isclass):
                    # Skip private attributes and avoid duplicates
                    if name.startswith("_") or name in classes:
                        continue

                    # Only include classes from this module or submodules
                    if hasattr(attr, "__module__") and attr.__module__.startswith(
                        module_path
                    ):
                        classes.append(name)
            except ImportError:
                print(f"Could not import module {mod_path}")
                continue

        # Sort the classes alphabetically and remove duplicates
        classes = sorted(list(set(classes)))

        # Special case for document loaders - prioritize common classes
        if "document_loaders" in module_path:
            priority_classes = []
            regular_classes = []

            for cls in classes:
                if cls in [
                    "PyPDFLoader",
                    "TextLoader",
                    "CSVLoader",
                    "JSONLoader",
                    "WebBaseLoader",
                ]:
                    priority_classes.append(cls)
                else:
                    regular_classes.append(cls)

            classes = priority_classes + regular_classes

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
    # library = request.args.get("library", "langchain")
    module_path = request.args.get("module", "")
    class_name = request.args.get("class_name", "")

    # Generate cache key
    cache_key = f"{module_path}:{class_name}"

    # Check cache first
    cached_result = class_details_cache.get(cache_key)
    if cached_result:
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

            for submodule_info in pkgutil.iter_modules(
                module.__path__ if hasattr(module, "__path__") else []
            ):
                submodule_name = f"{module_path}.{submodule_info.name}"
                try:
                    submodule = importlib.import_module(submodule_name)
                    if hasattr(submodule, class_name):
                        class_obj = getattr(submodule, class_name)
                        break
                except ImportError:
                    continue

            if class_obj is None:
                return (
                    jsonify(
                        {
                            "error": f"Class {class_name} not found in module {module_path}"
                        }
                    ),
                    404,
                )
        else:
            class_obj = getattr(module, class_name)

        # Get docstring
        docstring = inspect.getdoc(class_obj) or "No documentation available"

        # Get methods and patch them if needed
        methods = []
        method_names = []
        static_methods = []
        class_methods = []

        # Get instance methods (functions)
        for name, method in inspect.getmembers(class_obj, inspect.isfunction):
            # Skip private methods except __init__
            if name.startswith("_") and not name == "__init__":
                continue

            method_names.append(name)

            # Get method signature
            try:
                sig = inspect.signature(method)
                parameters = []

                for param_name, param in sig.parameters.items():
                    # Skip self parameter
                    if param_name == "self":
                        continue

                    param_info = {
                        "name": param_name,
                        "required": param.default == inspect.Parameter.empty,
                        "default": (
                            str(param.default)
                            if param.default != inspect.Parameter.empty
                            else None
                        ),
                        "type": (
                            str(param.annotation)
                            if param.annotation != inspect.Parameter.empty
                            else "Any"
                        ),
                    }
                    parameters.append(param_info)

                method_info = {
                    "name": name,
                    "doc": inspect.getdoc(method) or "No documentation available",
                    "parameters": parameters,
                    "is_static": False,
                    "is_classmethod": False,
                }
                methods.append(method_info)
            except (TypeError, ValueError, AttributeError) as e:
                # Skip methods with invalid signatures
                print(f"Error getting signature for {name}: {str(e)}")
                continue

        # Get static methods
        for name, method in inspect.getmembers(class_obj, inspect.ismethod):
            # Check if it's a static method
            if isinstance(inspect.getattr_static(class_obj, name, None), staticmethod):
                static_methods.append(name)
                method_names.append(name)

                try:
                    # Get the underlying function from the static method
                    underlying_func = inspect.getattr_static(class_obj, name).__func__
                    sig = inspect.signature(underlying_func)
                    parameters = []

                    for param_name, param in sig.parameters.items():
                        param_info = {
                            "name": param_name,
                            "required": param.default == inspect.Parameter.empty,
                            "default": (
                                str(param.default)
                                if param.default != inspect.Parameter.empty
                                else None
                            ),
                            "type": (
                                str(param.annotation)
                                if param.annotation != inspect.Parameter.empty
                                else "Any"
                            ),
                        }
                        parameters.append(param_info)

                    method_info = {
                        "name": name,
                        "doc": inspect.getdoc(method) or "No documentation available",
                        "parameters": parameters,
                        "is_static": True,
                        "is_classmethod": False,
                    }
                    methods.append(method_info)
                except (TypeError, ValueError, AttributeError) as e:
                    print(f"Error getting signature for static method {name}: {str(e)}")
                    continue

        # Get class methods
        for name, method in inspect.getmembers(class_obj, inspect.ismethod):
            # Check if it's a class method
            if isinstance(inspect.getattr_static(class_obj, name, None), classmethod):
                class_methods.append(name)
                method_names.append(name)

                try:
                    # Get the underlying function from the class method
                    underlying_func = inspect.getattr_static(class_obj, name).__func__
                    sig = inspect.signature(underlying_func)
                    parameters = []

                    for param_name, param in sig.parameters.items():
                        # Skip cls parameter for class methods
                        if param_name == "cls":
                            continue

                        param_info = {
                            "name": param_name,
                            "required": param.default == inspect.Parameter.empty,
                            "default": (
                                str(param.default)
                                if param.default != inspect.Parameter.empty
                                else None
                            ),
                            "type": (
                                str(param.annotation)
                                if param.annotation != inspect.Parameter.empty
                                else "Any"
                            ),
                        }
                        parameters.append(param_info)

                    method_info = {
                        "name": name,
                        "doc": inspect.getdoc(method) or "No documentation available",
                        "parameters": parameters,
                        "is_static": False,
                        "is_classmethod": True,
                    }
                    methods.append(method_info)
                except (TypeError, ValueError, AttributeError) as e:
                    print(f"Error getting signature for class method {name}: {str(e)}")
                    continue

        # Check for common static/class method patterns in LangChain
        # Some LangChain classes define from_* methods that may not be properly detected
        for name in dir(class_obj):
            if (
                name.startswith("from_")
                and not name.startswith("_")
                and name not in method_names
                and callable(getattr(class_obj, name, None))
            ):

                try:
                    method = getattr(class_obj, name)
                    sig = inspect.signature(method)
                    parameters = []

                    # Check if the first parameter is 'cls' (indicating a classmethod)
                    param_names = list(sig.parameters.keys())
                    is_classmethod_pattern = (
                        len(param_names) > 0 and param_names[0] == "cls"
                    )

                    for param_name, param in sig.parameters.items():
                        # Skip cls parameter for class methods
                        if param_name == "cls":
                            continue

                        param_info = {
                            "name": param_name,
                            "required": param.default == inspect.Parameter.empty,
                            "default": (
                                str(param.default)
                                if param.default != inspect.Parameter.empty
                                else None
                            ),
                            "type": (
                                str(param.annotation)
                                if param.annotation != inspect.Parameter.empty
                                else "Any"
                            ),
                        }
                        parameters.append(param_info)

                    method_names.append(name)
                    method_info = {
                        "name": name,
                        "doc": inspect.getdoc(method) or "No documentation available",
                        "parameters": parameters,
                        "is_static": not is_classmethod_pattern,
                        "is_classmethod": is_classmethod_pattern,
                    }
                    methods.append(method_info)

                    if is_classmethod_pattern:
                        class_methods.append(name)
                    else:
                        static_methods.append(name)

                except (TypeError, ValueError, AttributeError) as e:
                    print(f"Error getting signature for method {name}: {str(e)}")
                    continue

        # Get init parameters with special handling for document loaders and Pydantic models
        init_params = []

        # If no fields found from Pydantic-style inspection, use regular signature inspection
        if not init_params:
            # Check if we have special parameter handling for this class
            # Get the __init__ method signature
            init_sig = inspect.signature(class_obj)
            for param_name, param in init_sig.parameters.items():
                # Skip self parameter
                if param_name == "self":
                    continue

                param_info = {
                    "name": param_name,
                    "required": param.default == inspect.Parameter.empty,
                    "default": (
                        str(param.default)
                        if param.default != inspect.Parameter.empty
                        else None
                    ),
                    "type": (
                        str(param.annotation)
                        if param.annotation != inspect.Parameter.empty
                        else "Any"
                    ),
                }
                init_params.append(param_info)

        # Get class inheritance to determine type
        class_type = []
        try:
            for base in class_obj.__mro__[1:]:  # Skip the class itself
                if base.__module__.startswith("langchain"):
                    class_type.append(base.__name__)
        except Exception as e:
            print(f"Error getting class inheritance: {str(e)}")

        # Add component type based on module path
        component_type = ""
        if "document_loaders" in module_path:
            component_type = "document_loaders"
        elif "text_splitters" in module_path:
            component_type = "text_splitters"
        elif "embedding" in module_path or "embed" in class_name.lower():
            component_type = "embeddings"
        elif "vectorstore" in module_path:
            component_type = "vectorstores"
        elif "retriever" in module_path:
            component_type = "retrievers"
        elif "llm" in module_path:
            component_type = "llms"
        elif "chat" in module_path:
            component_type = "chat_models"
        elif "chain" in module_path:
            component_type = "chains"

        result = {
            "doc": docstring,
            "methods": method_names,
            "method_details": methods,
            "init_params": init_params,
            "class_type": class_type,
            "component_type": component_type,
            "static_methods": static_methods,
            "class_methods": class_methods,
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
        function_parts = [
            f"def create_{class_name.lower()}({', '.join([p for p in parameters])}):",
            f"    instance = {module_path}.{class_name}({', '.join([f'{k}={k}' for k in parameters])})",
            "    return instance",
        ]

        # Add additional method calls if provided
        for method in methods:
            if (
                method != "__init__"
            ):  # Skip __init__ as it's handled in the instantiation
                method_params = data.get(f"params_{method}", {})
                param_str = ", ".join([f"{k}={v}" for k, v in method_params.items()])
                function_parts.append(f"    # Call {method} method")
                function_parts.append(f"    result = instance.{method}({param_str})")
                function_parts.append("    return result")

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

                # Handle late initialization setting
                self.late_initialization = parameters.get("late_initialization", False)

            def validate_connections(self) -> bool:
                # Basic validation - could be enhanced based on specific requirements
                return True

        # Add the custom block to the canvas
        canvas.add_block(block_id, CustomBlock())

        return jsonify(
            {
                "status": "success",
                "message": f"Created custom block for {class_name}",
                "block_id": block_id,
                "input_nodes": input_nodes,
                "output_nodes": output_nodes,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/blocks/create_godprompt", methods=["POST"])
def create_godprompt_block():
    """Create a Godpromptblock - a special custom block for prompt formatting."""
    data = request.json
    block_id = data.get("id")
    prompt_text = data.get("prompt", "Enter your prompt here...")
    question_text = data.get("question", "Enter your question here...")

    if not block_id:
        return jsonify({"error": "Missing block ID"}), 400

    try:
        # Create a special Godpromptblock class
        class GodpromptBlock(Block):
            def __init__(self):
                super().__init__()
                self.block_type = "godprompt"
                self.class_name = "GodpromptBlock"
                self.module_path = ""
                self.component_type = "prompt_formatter"
                self.config = {
                    "prompt": prompt_text,
                    "question": question_text,
                    "parameters": {"prompt": prompt_text, "question": question_text},
                }
                # Define the method this block provides
                self.selected_methods = ["format_prompt"]
                self.methods = ["format_prompt"]
                self.parameters = {
                    "format_prompt": [
                        {"name": "context", "required": True, "type": "str"},
                        {
                            "name": "prompt",
                            "required": False,
                            "type": "str",
                            "default": prompt_text,
                        },
                        {
                            "name": "question",
                            "required": False,
                            "type": "str",
                            "default": question_text,
                        },
                    ]
                }
                self.static_methods = []
                self.class_methods = []

                # Set import and function strings for code generation
                self.import_string = "# Custom Godpromptblock - no imports needed"
                self.function_string = self._generate_function_string()

            def _generate_function_string(self):
                return f'''
class GodpromptBlock:
    """Custom prompt formatting block that combines context, prompt, and question."""
    
    def __init__(self, prompt="{prompt_text}", question="{question_text}"):
        self.prompt = prompt
        self.question = question
    
    def format_prompt(self, context, prompt=None, question=None):
        """Format the prompt using context, prompt, and question."""
        if prompt is None:
            prompt = self.prompt
        if question is None:
            question = self.question
        
        # Combine everything into a formatted string
        formatted_prompt = f\"\"\"Context: {{context}}

Prompt: {{prompt}}

Question: {{question}}\"\"\"
        
        return formatted_prompt
'''

            def validate_connections(self) -> bool:
                return True

        # Add the Godpromptblock to the canvas
        canvas.add_block(block_id, GodpromptBlock())

        return jsonify(
            {
                "status": "success",
                "message": "Godpromptblock created successfully",
                "block_id": block_id,
                "block_type": "godprompt",
                "class_name": "GodpromptBlock",
                "input_nodes": ["context_input"],
                "output_nodes": ["formatted_prompt_output"],
                "config": {
                    "prompt": prompt_text,
                    "question": question_text,
                    "methods": ["format_prompt"],
                    "selected_methods": ["format_prompt"],
                    "parameters": {"prompt": prompt_text, "question": question_text},
                },
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/templates/save", methods=["POST"])
def save_template():
    """Save the current pipeline state as a template."""
    try:
        data = request.json
        template_name = data.get("template_name", "My Template")
        blocks_data = data.get("blocks", {})
        connections_data = data.get("connections", [])

        # Create a template object with all necessary data
        template = {
            "name": template_name,
            "created_at": __import__("datetime").datetime.now().isoformat(),
            "blocks": blocks_data,
            "connections": connections_data,
        }

        # Just return the template JSON for the client to download
        return jsonify(
            {
                "status": "success",
                "message": "Template ready for download",
                "template": template,
            }
        )
    except Exception as e:
        print(f"Template save error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/templates/load", methods=["POST"])
def load_template():
    """Process an uploaded template file to restore a pipeline."""
    try:
        data = request.json
        template_data = data.get("template")

        if not template_data:
            return jsonify({"error": "No template data provided"}), 400

        # Basic validation of the template structure
        if "blocks" not in template_data or "connections" not in template_data:
            return jsonify({"error": "Invalid template format"}), 400

        # Return success - client will handle the actual restoration
        return jsonify({"status": "success", "message": "Template loaded successfully"})
    except Exception as e:
        print(f"Template load error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.before_request
def check_maintenance_mode():
    # Skip for static files and auth routes
    if request.path.startswith("/static") or request.path.startswith("/auth"):
        return

    settings = AdminPanel.query.first()
    if settings and settings.maintenance_mode:
        # Allow admins to access everything
        if current_user.is_authenticated and getattr(current_user, "is_admin", False):
            return
        # Show maintenance page to everyone else
        return (
            render_template("maintenance.html", message=settings.maintenance_message),
            503,
        )


@app.before_request
def enforce_public_mode():
    # Skip for static files
    if request.path.startswith("/static"):
        return
    # Skip for admin routes - they are handled by @login_required and @admin_required
    if request.path.startswith("/admin"):
        return
    # Skip for auth routes and their subpaths
    if request.path.startswith("/auth") or request.path in [
        "/login",
        "/register",
        "/reset_password_request",
    ]:
        return

    settings = AdminPanel.query.first()
    if settings and not settings.public_mode:
        if not current_user.is_authenticated:
            # Store the current URL in the session
            session["next"] = request.url
            return redirect(url_for("auth.login"))


# Create database tables
# This is now handled by init_db.py when the Docker container starts
# or when init_db.py is run manually.
# with app.app_context():
#     db.create_all()


if __name__ == "__main__":
    app.run(debug=True)
