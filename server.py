from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from flask_login import current_user
import importlib
import inspect
import pkgutil
import traceback
from blocks import Canvas, Block
from extensions import db, login_manager, init_app
from models import AdminPanel, User
from auth import auth as auth_blueprint
from admin import admin as admin_blueprint

import os
import logging

log = logging.getLogger("werkzeug")  # Suppress werkzeug logging
log.setLevel(logging.ERROR)

app = Flask(__name__, static_folder="static", template_folder="static/html")
CORS(app)

# Configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-key-please-change")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///app.db"
)
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
                    self.class_name = None  # Will be set properly based on block_type
                    self.module_path = ""  # Default empty module path
                    self.config = config
                    self.component_type = ""  # Default empty component type
                    self.selected_methods = []
                    self.parameters = {}  # Store parameter info for methods

                    # Extract module path and class name from block_type
                    if block_type.startswith("custom_"):
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

                    # Extract methods from block info or config
                    if "methods" in config:
                        self.selected_methods = config["methods"]
                    elif "selected_methods" in config:
                        self.selected_methods = config["selected_methods"]
                        print(
                            f"Found methods in config.selected_methods: {self.selected_methods}"
                        )
                    elif "selected_methods" in config.get("config", {}):
                        self.selected_methods = config["config"]["selected_methods"]
                        print(
                            f"Found methods in config.config.selected_methods: {self.selected_methods}"
                        )

                    # Look for a selected method that might not be in the methods list yet
                    selected_method = None
                    if "selected_method" in config:
                        selected_method = config["selected_method"]
                        print(f"Found selected_method in config: {selected_method}")
                    elif "selected_method" in config.get("config", {}):
                        selected_method = config["config"]["selected_method"]
                        print(
                            f"Found selected_method in config.config: {selected_method}"
                        )

                    # If we have a selected method but it's not in our list yet, add it
                    if selected_method and (
                        not self.selected_methods
                        or selected_method not in self.selected_methods
                    ):
                        if not self.selected_methods:
                            self.selected_methods = [selected_method]
                        else:
                            self.selected_methods.append(selected_method)
                        print(
                            f"Added selected_method {selected_method} to methods list"
                        )

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

                def validate_connections(self) -> bool:
                    return True

            temp_canvas.add_block(block_id, CustomPipelineBlock())

        # Now, for special connections between blocks with specific method nodes
        reverse_connection_map = {}
        method_connection_map = {}  # Maps block_id -> input_node -> source blocks

        # Create a plain connections dict format for execution order
        canvas_connections = {}
        print("\nconnection data found:", connections_data)
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

        # Look for method-specific connections
        # This additional loop processes the original connections data
        # to extract method-specific info
        print("\nProcessing connections for method-specific information:")
        for conn in connections_data:
            source_id = conn.get("source")
            target_id = conn.get("target")
            input_id = conn.get("inputId", "")
            source_method = conn.get("sourceMethod", "")
            target_method = conn.get("targetMethod", "")
            source_node = conn.get("sourceNode", "")

            if not (source_id and target_id):
                continue

            # Skip if either block doesn't exist
            if (
                source_id not in temp_canvas.blocks
                or target_id not in temp_canvas.blocks
            ):
                continue

            # If we don't have explicit method information, try to extract it from input/output nodes
            if not source_method and source_node and "_output" in source_node:
                source_method = source_node.split("_")[0]
                print(
                    f"Extracted source_method '{source_method}' from source_node '{source_node}'"
                )

            if not target_method and input_id and "_input" in input_id:
                target_method = input_id.split("_")[0]
                print(
                    f"Extracted target_method '{target_method}' from input_id '{input_id}'"
                )

            # Always add to method_connection_map - even if we don't have explicit method information
            if target_id not in method_connection_map:
                method_connection_map[target_id] = {}

            # First, handle method-specific connection if we have target method
            if target_method:
                # Create an entry for this target method if it doesn't exist
                if target_method not in method_connection_map[target_id]:
                    method_connection_map[target_id][target_method] = []

                # Add source to this target method's connections
                if source_id not in method_connection_map[target_id][target_method]:
                    method_connection_map[target_id][target_method].append(source_id)
                    print(
                        f"Added source {source_id} to target {target_id}'s {target_method} method connections"
                    )
            else:
                # No target method, use default
                if "default" not in method_connection_map[target_id]:
                    method_connection_map[target_id]["default"] = []

                # Add source to default connections
                if source_id not in method_connection_map[target_id]["default"]:
                    method_connection_map[target_id]["default"].append(source_id)
                    print(
                        f"Added source {source_id} to target {target_id}'s default connections"
                    )

            # Log all connections with detailed information
            # connection_type = (
            #     "method-specific" if target_method or source_method else "standard"
            # )
            # print(
            #     f"Connection: {source_id}{' (' + source_method + ')' if source_method else ''} -> {target_id}{' (' + target_method + ')' if target_method else ''} [{connection_type}]"
            # )

        # Print out the method_connection_map for debugging
        # print("\nFinal method connection map:")
        # for target_id, methods in method_connection_map.items():
        # print(f"Target {target_id}:")
        # for method, sources in methods.items():
        #     print(f"  Method {method}: {sources}")

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
    """Generate Python code for blocks and connections similar to block_sim.py logic."""
    # Determine execution order
    execution_order = determine_execution_order(blocks, connections)

    # Initialize collections
    imports = set()
    init_code_lines = []
    method_code_lines = []


    # Check if we need to create files directory
    has_file_paths = False

    # Track blocks that have already been initialized with special handling
    special_init_blocks = set()

    # First scan to collect all imports upfront
    # print(f"Processing {len(blocks)} blocks for imports...")
    for block_id, block in blocks.items():
        # Only add non-comment imports
        # print(f"Processing block {block_id} with import string: {block.import_string}")
        if (
            hasattr(block, "import_string")
            and block.import_string
            and not block.import_string.startswith("#")
        ):
            imports.add(block.import_string)
            # print(f"Added import: {block.import_string}")
        # Fallback for blocks with module path but no import string
        elif (
            hasattr(block, "module_path")
            and block.module_path
            and hasattr(block, "class_name")
        ):
            import_statement = f"from {block.module_path} import {block.class_name}"
            imports.add(import_statement)
            # print(f"Added generated import: {import_statement}")

    # print(f"\nCollected {len(imports)} imports: {imports}")

    # Create variable names for each block
    block_vars = {}
    for i, block_id in enumerate(execution_order):
        block = blocks[block_id]
        class_name = (
            block.class_name if hasattr(block, "class_name") else type(block).__name__
        )
        var_name = f"{class_name.lower()}_{i+1}".replace(" ", "_").replace("-", "_")
        block_vars[block_id] = var_name


        # Check if this block uses file paths
        if hasattr(block, "config") and block.config:
            # First check for parameters dictionary
            if "parameters" in block.config and isinstance(
                block.config["parameters"], dict
            ):
                for param_name, param_value in block.config["parameters"].items():
                    if isinstance(param_value, str) and "files/" in param_value:
                        has_file_paths = True
                        break

    # Build connection maps for easier processing
    connection_map = {}  # source -> [targets]
    reverse_connection_map = {}  # target -> [sources]

    for source_id, targets in connections.items():
        if source_id not in connection_map:
            connection_map[source_id] = []
        for target_id in targets:
            connection_map[source_id].append(target_id)
            if target_id not in reverse_connection_map:
                reverse_connection_map[target_id] = []
            reverse_connection_map[target_id].append(source_id)

    # First, handle all block initializations in the proper order
    for block_id in execution_order:
        block = blocks[block_id]
        var_name = block_vars[block_id]
        class_name = (
            block.class_name if hasattr(block, "class_name") else type(block).__name__
        )

        # Build initialization parameters
        init_params = []
        if hasattr(block, "config") and block.config:
            # First check for parameters dictionary (from dropdown UI)
            if "parameters" in block.config and isinstance(
                block.config["parameters"], dict
            ):
                for param_name, param_value in block.config["parameters"].items():
                    # Skip empty string values
                    if param_value == "":
                        continue

                    # Format the value properly
                    if isinstance(param_value, str):
                        # Special handling for file paths
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
                                        init_params = []
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
                        elif not (
                            param_value.startswith(
                                ("'", '"', "[", "{", "True", "False", "None")
                            )
                            or param_value.isdigit()
                        ):
                            param_value = f'"{param_value}"'

                    init_params.append(f"{param_name}={param_value}")

            # Then add other parameters from config (excluding non-initialization ones)
            for param_name, param_value in block.config.items():
                # Skip non-initialization parameters, class_name and parameters dict itself
                if param_name in [
                    "methods",
                    "selected_methods",
                    "selected_method",
                    "class_name",
                    "parameters",
                ]:
                    continue

                # Skip empty string values
                if param_value == "":
                    continue

                # Format the value properly
                if isinstance(param_value, str):
                    if not (
                        param_value.startswith(
                            ("'", '"', "[", "{", "True", "False", "None")
                        )
                        or param_value.isdigit()
                    ):
                        param_value = f'"{param_value}"'

                init_params.append(f"{param_name}={param_value}")

        # Add initialization code - only if not specially initialized
        if block_id not in special_init_blocks:
            init_code_lines.append(f"# Initialize {class_name}")
            init_code_lines.append(
                f"{var_name} = {class_name}({', '.join(init_params)})"
            )

    # Track processed methods to avoid duplicates
    processed_methods = {block_id: set() for block_id in blocks}

    # Now generate method execution code for each block
    for block_id in execution_order:
        block = blocks[block_id]
        var_name = block_vars[block_id]
        class_name = (
            block.class_name if hasattr(block, "class_name") else type(block).__name__
        )
        # component_type = (
        #    block.component_type if hasattr(block, "component_type") else ""
        # )

        # Get the selected method from config if available
        selected_method = None
        if hasattr(block, "config") and block.config:
            selected_method = block.config.get("selected_method")

        # Get methods for this block (excluding __init__)
        methods_to_execute = []
        # First check for explicitly selected methods
        if hasattr(block, "config") and block.config:
            if "selected_methods" in block.config and isinstance(
                block.config["selected_methods"], list
            ):
                methods_to_execute = [
                    m for m in block.config["selected_methods"] if m != "__init__"
                ]

        # If no selected methods in config, try block attributes
        if not methods_to_execute:
            if hasattr(block, "methods"):
                methods_to_execute = [m for m in block.methods if m != "__init__"]
            elif hasattr(block, "selected_methods"):
                methods_to_execute = [
                    m for m in block.selected_methods if m != "__init__"
                ]

        # Prioritize specific selected method if available
        if selected_method and selected_method != "__init__":
            # Make sure selected_method is at the start of the list
            if selected_method in methods_to_execute:
                methods_to_execute.remove(selected_method)
            methods_to_execute.insert(0, selected_method)

# Make sure we have unique methods
        methods_to_execute = list(dict.fromkeys(methods_to_execute))

        # Print methods to execute for this block
        print(f"Methods to execute for {class_name}: {methods_to_execute}")

        # If no methods are available, don't execute any methods
        if not methods_to_execute:
            continue

        # Execute methods for this block
        for method_name in methods_to_execute:
            # if method_name == "load" and block_id in special_init_blocks:
            #     continue

            # method_code_lines.append(f"# Execute {method_name} on {class_name}")
            print(f"Generating code for method {method_name} on {class_name}")

            # Check if we should use method-specific connections
            should_use_method_connections = False
            method_specific_sources = []

            # print("\nconnections:", method_connections)

            if method_connections and block_id in method_connections:
                # If we have the method in our method connections map
                if method_name in method_connections[block_id]:
                    should_use_method_connections = True
                    method_specific_sources = method_connections[block_id][method_name]
                    print(
                        f"Using method-specific connections for {method_name} on {class_name}: {method_specific_sources}"
                    )
                else:
                    print(
                        f"No method-specific connections for {method_name} on {class_name}, using general connections"
                    )
            else:
                print(f"No method connections for block {block_id} ({class_name})")

            source_params = []

            # print("\nconnections?\n")
            # If this block has incoming method-specific connections, use them as parameters
            if should_use_method_connections and method_specific_sources:
                # print("\nyes\n")
                # Use method-specific connections
                for source_id in method_specific_sources:
                    source_var = block_vars[source_id]

                    # Look for method-specific outputs from source block
                    # The connection should indicate which source method output to use
                    source_method = None

                    # Check each connection to see if it connects this source to this target method
                    for conn in connections_data:
                        # if (
                        #     conn.get("source") == source_id
                        #     and conn.get("target") == block_id
                        #     and conn.get("targetMethod") == method_name
                        # ):
                        source_method = conn.get("sourceMethod")
                        break

                    # If there's a specific source method, use its output variable
                    if source_method:
                        source_params.append(f"{source_var}_{source_method}_output")
                        print(
                            f"Using {source_var}_{source_method}_output as input for {var_name}.{method_name}"
                        )
                    else:
                        # Otherwise use the general output variable
                        source_params.append(f"{source_var}_output")
                        print(
                            f"Using {source_var}_output as input for {var_name}.{method_name} (no specific source method found)"
                        )
            else:
                # Try to find any connection between this block and any source blocks
                # that might be relevant for this method

                if block_id in reverse_connection_map:
                    source_ids = reverse_connection_map[block_id]

                    for source_id in source_ids:
                        source_var = block_vars[source_id]
                        # Try to find if there's a connection specifying this method
                        source_method = None
                        for conn in connections_data:
                            if (
                                conn.get("source") == source_id
                                and conn.get("target") == block_id
                            ):
                                # First look for exact target method match
                                if (
                                    conn.get("inputId").replace("_input", "")
                                    == method_name
                                ):
                                    source_method = conn.get("sourceNode").replace(
                                        "_output", ""
                                    )
                                    break
                                # Then check if there's any source method that might be used
                                elif not conn.get("targetMethod") and conn.get(
                                    "sourceMethod"
                                ):
                                    source_method = conn.get("sourceMethod")
                                    print(
                                        f"Found possible source method {source_method} from {source_id} to use with {method_name}"
                                    )

                        # If we found a related source method, use its output
                        if source_method:
                            source_params.append(f"{source_var}_{source_method}_output")
                            print(
                                f"Using {source_var}_{source_method}_output as input for {var_name}.{method_name}"
                            )
                        else:
                            # Otherwise use the default output variable from that source
                            source_params.append(f"{source_var}_output")
                            print(
                                f"Using {source_var}_output as input for {var_name}.{method_name}"
                            )

            # Now generate the method call code, with or without parameters
            if source_params:
                # Filter out any empty parameters
                filtered_params = [p for p in source_params if p and p.strip() != ""]

                # For methods with only one parameter, pass it as the first argument
                if len(filtered_params) == 1:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {var_name}.{method_name}({filtered_params[0]})"
                    )
                elif len(filtered_params) > 1:
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {var_name}.{method_name}({', '.join(filtered_params)})"
                    )
                else:
                    # Empty filtered_params list - call without parameters
                    method_code_lines.append(
                        f"{var_name}_{method_name}_output = {var_name}.{method_name}()"
                    )
            else:
                # No parameters at all, call method without arguments
                method_code_lines.append(
                    f"{var_name}_{method_name}_output = {var_name}.{method_name}()"
                )

            # Mark this method as processed
            processed_methods[block_id].add(method_name)

            # If it's the selected method, we can stop after processing it

    # Collect clean lines for the final code
    clean_code_lines = []

    # Add imports at the top
    clean_code_lines.append("# Imports")
    for imp in sorted(list(imports)):
        clean_code_lines.append(imp)
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

        clean_code_lines.append("# Print the final result")
        clean_code_lines.append(f'print("\\nFinal result from {last_class}:")')
        clean_code_lines.append(f"print({last_var}_output)")

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
                }
                methods.append(method_info)
            except (TypeError, ValueError, AttributeError) as e:
                # Skip methods with invalid signatures
                print(f"Error getting signature for {name}: {str(e)}")
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
    # Skip for static files and auth routes
    if request.path.startswith("/static") or request.path.startswith("/auth"):
        return
    # Skip for admin routes - they are handled by @login_required and @admin_required
    if request.path.startswith("/admin"):
        return
    # Prevent redirect loop: if already on /login, do not redirect
    if request.path == "/login":
        return
    settings = AdminPanel.query.first()
    if settings and not settings.public_mode:
        if not current_user.is_authenticated:
            # Prevent redirect loop: do not set next to /login or /auth/login
            if request.path == "/login" or request.path.startswith("/auth/login"):
                return
            # Store the current URL as the next parameter only if it's not /login
            return redirect(url_for("auth.login", next=request.url))


# Create database tables
with app.app_context():
    db.create_all()


if __name__ == "__main__":
    canvas.clear()  # Clear the canvas to prevent custom blocks from persisting
    app.run(debug=True)
