from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import importlib
import inspect
import pkgutil
import platform
import subprocess
import time
import traceback
from werkzeug.utils import secure_filename
from datetime import datetime
from blocks import (
    Canvas,
    Block,
)

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
    output_file = data.get("output_file", "generated_pipeline.py")
    blocks_data = data.get("blocks", {})
    connections_data = data.get("connections", [])  # Array of connection objects

    try:
        # Create a temporary Canvas with the blocks from the request
        temp_canvas = Canvas()

        # Add blocks from the request
        for block_id, block_info in blocks_data.items():
            block_type = block_info.get("type")

            # Create a custom block instance
            class CustomPipelineBlock(Block):
                def __init__(self):
                    super().__init__()
                    self.block_type = block_type
                    self.config = block_info.get("config", {})
                    self.import_string = f"# Import for {block_type}"
                    self.function_string = f"def create_{block_type.lower()}():\n    # Initialize {block_type}\n    return '{block_type} instance'"

                def validate_connections(self) -> bool:
                    return True

            temp_canvas.add_block(block_id, CustomPipelineBlock())

        # Convert connections array to dictionary format
        # canvas.connections format: {source_id: [target_id1, target_id2, ...]}
        canvas_connections = {}

        for conn in connections_data:
            source_id = conn.get("source")
            target_id = conn.get("target")

            if source_id and target_id and source_id in temp_canvas.blocks and target_id in temp_canvas.blocks:
                if source_id not in canvas_connections:
                    canvas_connections[source_id] = []
                if target_id not in canvas_connections[source_id]:
                    canvas_connections[source_id].append(target_id)

        # Set the connections on the temp canvas
        temp_canvas.connections = canvas_connections

        # Define the output file path
        temp_file = output_file

        # Export the code - using custom export logic similar to block_sim.py
        generated_code = generate_python_code(temp_canvas.blocks, temp_canvas.connections)

        # Write the generated code to the file
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(generated_code)

        # Return the code as part of the response
        return jsonify({
                "status": "success",
            "message": "Successfully generated Python code",
            "code": generated_code,
            "file": output_file,
        })
            except Exception as e:
        print(f"Export error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def generate_python_code(blocks, connections):
    """Generate Python code for blocks and connections similar to block_sim.py logic."""
    # Determine execution order
    execution_order = determine_execution_order(blocks, connections)

    # Initialize code sections
    imports = []
    class_creations = []
    method_calls = []

    # Generate variable names for each block
    block_vars = {}
    for i, block_id in enumerate(execution_order):
        block = blocks[block_id]
        block_type = block.block_type if hasattr(block, 'block_type') else type(block).__name__
        var_name = f"{block_type.lower()}_{i+1}".replace(' ', '_')
        block_vars[block_id] = var_name

    # Process blocks in execution order
    for block_id in execution_order:
        block = blocks[block_id]
        var_name = block_vars[block_id]
        block_type = block.block_type if hasattr(block, 'block_type') else type(block).__name__

        # Add imports
        if hasattr(block, 'module_path'):
            imports.append(f"import {block.module_path}")

        # Add class creation
        class_creations.append(f"# Initialize {block_type}")

        # If it's a custom block with parameters, use them
        if hasattr(block, 'config') and block.config:
            params = []
            for param_name, param_value in block.config.items():
                if isinstance(param_value, str):
                    if not (param_value.startswith(("'", '"', "[", "{", "True", "False", "None")) or param_value.isdigit()):
                        param_value = f'"{param_value}"'
                params.append(f"{param_name}={param_value}")

            class_creations.append(f"{var_name} = {block_type}({', '.join(params)})")
            else:
            class_creations.append(f"{var_name} = {block_type}()")

        # Add method calls based on block connections
        # The block at the end of the connection calls methods on the blocks at the start
        for source_id, targets in connections.items():
            if block_id in targets:
                source_var = block_vars[source_id]
                method_calls.append(f"# Process data from {source_var}")
                if hasattr(block, 'methods') and block.methods:
                    for method in block.methods:
                        if method != "__init__":
                            method_calls.append(f"result = {var_name}.{method}({source_var})")
                    else:
                    method_calls.append(f"result = {var_name}.process({source_var})")

    # Assemble the final code
    code_parts = []

    # Add imports
    if imports:
        code_parts.append("# Imports")
        code_parts.extend(sorted(list(set(imports))))
        code_parts.append("")

    # Add class creations
    if class_creations:
        code_parts.append("# Initialize objects")
        code_parts.extend(class_creations)
        code_parts.append("")

    # Add method calls
    if method_calls:
        code_parts.append("# Process data through the pipeline")
        code_parts.extend(method_calls)
        code_parts.append("")

    # Add final print for the last block
    if execution_order:
        last_block_id = execution_order[-1]
        last_var = block_vars[last_block_id]
        code_parts.append("# Print the final result")
        code_parts.append(f"print({last_var})")

    return "\n".join(code_parts)

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
            return jsonify({
                "status": "error",
                "output": f"Block not found or not implemented: {block_type}",
                "block_id": block_id,
            })
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
                if is_document_loader:
                    # No special parameters by default
                    print(f"No special parameters defined for {class_name}")
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
    canvas.clear()  # Clear the canvas to prevent custom blocks from persisting
    app.run(debug=True)
