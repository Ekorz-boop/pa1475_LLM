from flask import Flask, request, jsonify
from flask_cors import CORS
import importlib
import inspect
import pkgutil
import traceback
import os
from blocks import (
    Canvas,
    Block,
)
import os

# import sys

app = Flask(__name__, static_folder="static")
CORS(app)

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
    try:
        data = request.get_json()
        blocks_data = data.get("blocks", [])
        connections_data = data.get("connections", [])
        output_file = data.get("output_file", "generated_pipeline.py")

        # Create a temporary canvas to manage the blocks
        canvas = {"blocks": {}, "connections": []}

        # CustomPipelineBlock to store block properties
        class CustomPipelineBlock:
            def __init__(self, block_id, block_type, config, class_name=None):
                self.id = block_id
                self.type = block_type
                self.config = config.copy() if config else {}
                self.class_name = class_name

                # Extract methods from config
                self.methods = config.get("methods", [])
                if not self.methods:
                    # Default fallback if no methods specified
                    self.methods = ["__init__", "call"]

                # Make sure __init__ is always included
                if "__init__" not in self.methods:
                    self.methods.insert(0, "__init__")

                # Determine component type based on class_name or module path
                self.component_type = ""
                if class_name:
                    parts = class_name.split(".")
                    class_path = ".".join(parts[:-1]) if len(parts) > 1 else ""

                    if (
                        "document_loaders" in class_path
                        or "loader" in parts[-1].lower()
                    ):
                        self.component_type = "document_loaders"
                    elif "text_splitters" in class_path:
                        self.component_type = "text_splitters"
                    elif "embedding" in class_path or "embed" in parts[-1].lower():
                        self.component_type = "embeddings"
                    elif "vectorstore" in class_path:
                        self.component_type = "vectorstores"
                    elif "retriever" in class_path:
                        self.component_type = "retrievers"
                    elif "llm" in class_path:
                        self.component_type = "llms"
                    elif "chat" in class_path:
                        self.component_type = "chat_models"
                    elif "chain" in class_path:
                        self.component_type = "chains"

                # Set the module path for imports
                if class_name and len(class_name.split(".")) > 1:
                    parts = class_name.split(".")
                    self.class_name = parts[-1]  # Last part is the actual class name
                    self.module_path = ".".join(
                        parts[:-1]
                    )  # The rest is the module path
                else:
                    self.module_path = ""

                # Remove methods from config to avoid duplicating them
                if "methods" in self.config:
                    del self.config["methods"]

        # Initialize blocks
        for block_data in blocks_data:
            block_id = block_data.get("id")
            block_type = block_data.get("type")
            config = block_data.get("config", {})
            class_name = block_data.get("className")

            canvas["blocks"][block_id] = CustomPipelineBlock(
                block_id, block_type, config, class_name
            )

        # Process connections
        for connection in connections_data:
            source_id = connection.get("source")
            target_id = connection.get("target")

            # Skip invalid connections
            if (
                not source_id
                or not target_id
                or source_id not in canvas["blocks"]
                or target_id not in canvas["blocks"]
            ):
                continue

            # Add connection to the list
            canvas["connections"].append({"source": source_id, "target": target_id})

        # Generate Python code based on blocks and connections
        generated_code = generate_python_code(canvas["blocks"], canvas["connections"])

        # Write to file
        filepath = os.path.join(os.getcwd(), output_file)
        with open(filepath, "w") as f:
            f.write(generated_code)

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


def generate_python_code(blocks, connections):
    """Generate Python code for blocks and connections similar to block_sim.py logic."""
    # Determine execution order
    execution_order = determine_execution_order(blocks, connections)

    # Initialize collections
    imports = set()
    init_code_lines = []
    method_code_lines = []

    # Add common imports
    imports.add("import os")
    imports.add("import sys")

    # Check if we need to create files directory
    has_file_paths = False

    # Track blocks that have already been initialized with special handling
    special_init_blocks = set()

    # Create variable names for each block
    block_vars = {}
    for i, block_id in enumerate(execution_order):
        block = blocks[block_id]
        class_name = (
            block.class_name if hasattr(block, "class_name") else type(block).__name__
        )
        var_name = f"{class_name.lower()}_{i+1}".replace(" ", "_").replace("-", "_")
        block_vars[block_id] = var_name

        # Add import for this block
        if hasattr(block, "module_path") and block.module_path:
            imports.add(f"from {block.module_path} import {class_name}")

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
                                        and (
                                            class_name == "PyPDFLoader"
                                            or class_name == "TextLoader"
                                            or class_name == "CSVLoader"
                                        )
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

        # Get the methods to execute for this block
        methods_to_execute = []
        if hasattr(block, "config") and block.config:
            if "methods" in block.config and isinstance(block.config["methods"], list):
                methods_to_execute = block.config["methods"]
            elif hasattr(block, "methods"):
                methods_to_execute = list(block.methods)
            elif hasattr(block, "selected_methods"):
                methods_to_execute = list(block.selected_methods)

        # Filter out __init__ as it's already handled in initialization
        methods_to_execute = [m for m in methods_to_execute if m != "__init__"]

        # If no methods are specified, skip this block
        if not methods_to_execute:
            continue

        # Generate code for each method in order
        for i, method_name in enumerate(methods_to_execute):
            # Skip if this method has already been processed for this block
            if method_name in processed_methods[block_id]:
                continue

            # Skip load() method for specially initialized document loaders
            if method_name == "load" and block_id in special_init_blocks:
                continue

            # Variable to store the output of this method
            result_var = (
                f"{var_name}_result_{i+1}"
                if i < len(methods_to_execute) - 1
                else f"{var_name}_output"
            )

            method_code_lines.append(f"# Execute {method_name} on {class_name}")

            # Get any parameters specifically for this method from config
            method_params = []
            if hasattr(block, "config") and block.config:
                # Check for method-specific parameters
                if "parameters" in block.config and isinstance(
                    block.config["parameters"], dict
                ):
                    for param_name, param_value in block.config["parameters"].items():
                        # Skip empty values
                        if param_value == "":
                            continue

                        # Format the parameter value properly
                        if isinstance(param_value, str):
                            if not (
                                param_value.startswith(
                                    ("'", '"', "[", "{", "True", "False", "None")
                                )
                                or param_value.isdigit()
                            ):
                                param_value = f'"{param_value}"'

                        # Add as a keyword argument
                        method_params.append(f"{param_name}={param_value}")

            # If this is the first method and there are incoming connections
            if i == 0 and block_id in reverse_connection_map:
                source_params = []
                for source_id in reverse_connection_map[block_id]:
                    source_var = block_vars[source_id]
                    source_params.append(f"{source_var}_output")

                # Handle special cases for document loaders
                if method_name == "load" and (
                    hasattr(block, "component_type")
                    and block.component_type == "document_loaders"
                ):
                    if method_params:
                        method_code_lines.append(
                            f"{result_var} = {var_name}.{method_name}({', '.join(method_params)})"
                        )
                    else:
                        method_code_lines.append(
                            f"{result_var} = {var_name}.{method_name}()"
                        )
                else:
                    # Filter out any empty parameters
                    filtered_params = [
                        p for p in source_params if p and p.strip() != ""
                    ]

                    # Combine positional and keyword parameters
                    all_params = filtered_params + method_params

                    if all_params:
                        method_code_lines.append(
                            f"{result_var} = {var_name}.{method_name}({', '.join(all_params)})"
                        )
                    else:
                        method_code_lines.append(
                            f"{result_var} = {var_name}.{method_name}()"
                        )
            # For subsequent methods, pass the output of the previous method
            elif i > 0:
                prev_result_var = f"{var_name}_result_{i}"

                if method_params:
                    method_code_lines.append(
                        f"{result_var} = {var_name}.{method_name}({prev_result_var}, {', '.join(method_params)})"
                    )
                else:
                    method_code_lines.append(
                        f"{result_var} = {var_name}.{method_name}({prev_result_var})"
                    )
            # For first method with no incoming connections
            else:
                if method_params:
                    method_code_lines.append(
                        f"{result_var} = {var_name}.{method_name}({', '.join(method_params)})"
                    )
                else:
                    method_code_lines.append(
                        f"{result_var} = {var_name}.{method_name}()"
                    )

            # Mark this method as processed
            processed_methods[block_id].add(method_name)

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
        print(f"Using cached classes for {module_path}")
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
            print(f"Found {len(classes)} classes in {module_path}")
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
                print(f"Scanning submodules in {module_path}")
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

        print(f"Found {len(modules_to_check)} modules/submodules to check for classes")

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
    module_path = request.args.get("module", "")
    class_name = request.args.get("class_name", "")

    # Generate cache key
    cache_key = f"{module_path}:{class_name}"

    # Check cache first
    # cached_result = class_details_cache.get(cache_key)
    # if cached_result:
    #    print(f"Using cached details for {cache_key}")
    #    return jsonify(cached_result)

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

        # Get methods and their parameters
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

        # Get init parameters without any special handling
        init_params = []
        component_type = ""

        # Identify component type based on module path
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

        # Always use inspect to get constructor parameters - no hardcoding
        try:
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
                print(f"Parameter: {param_name}")
                print(f"  Required: {param_info['required']}")
                print(f"  Default: {param_info['default']}")
                print(f"  Type: {param_info['type']}")
                init_params.append(param_info)
        except (TypeError, ValueError) as e:
            print(f"Error getting __init__ signature for {class_name}: {str(e)}")

        # Get class inheritance to determine type
        class_type = []
        try:
            for base in class_obj.__mro__[1:]:  # Skip the class itself
                if base.__module__.startswith("langchain"):
                    class_type.append(base.__name__)
        except Exception as e:
            print(f"Error getting class inheritance: {str(e)}")

        # If we couldn't determine class type from inheritance, infer from component_type
        if not class_type and component_type:
            if component_type == "document_loaders":
                class_type = ["DocumentLoader"]
            elif component_type == "text_splitters":
                class_type = ["TextSplitter"]
            elif component_type == "embeddings":
                class_type = ["Embeddings"]
            # Add more mappings as needed

        # For embedding methods, make sure we have parameters for embed_documents and embed_query
        if component_type == "embeddings":
            # Look for the Embeddings methods in the method_details
            embed_documents_method = next(
                (m for m in methods if m["name"] == "embed_documents"), None
            )
            embed_query_method = next(
                (m for m in methods if m["name"] == "embed_query"), None
            )

            # If we found methods but they don't have the right parameter names, fix them
            if embed_documents_method and not any(
                p["name"] == "texts" for p in embed_documents_method["parameters"]
            ):
                for param in embed_documents_method["parameters"]:
                    if param["name"] == "data":
                        param["name"] = "texts"

            if embed_query_method and not any(
                p["name"] == "text" for p in embed_query_method["parameters"]
            ):
                for param in embed_query_method["parameters"]:
                    if param["name"] == "data":
                        param["name"] = "text"

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


if __name__ == "__main__":
    canvas.clear()  # Clear the canvas to prevent custom blocks from persisting
    app.run(debug=True)
