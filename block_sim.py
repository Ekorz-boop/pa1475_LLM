import pkgutil
import importlib
import inspect
import os
from typing import List, Any, Optional

# Define RAG pipeline component types
RAG_COMPONENT_TYPES = {
    "document_loaders": "langchain_community.document_loaders",
    "text_splitters": "langchain_text_splitters",
    "embeddings": "langchain_community.embeddings",
    "vectorstores": "langchain_community.vectorstores",
    "retrievers": "langchain_community.retrievers",
    "llms": "langchain_community.llms",
    "chat_models": "langchain_community.chat_models",
    "prompts": "langchain_prompts",
    "output_parsers": "langchain_core.output_parsers",
    "chains": "langchain.chains",
}


class PipelineBlock:
    """
    A block in a RAG pipeline, representing a LangChain component.
    """

    def __init__(self, component_type: str, module_path: str, class_name: str):
        """Initialize a pipeline block."""
        self.component_type = component_type
        self.module_path = module_path
        self.class_name = class_name
        self.module = None
        self.cls = None
        self.instance = None
        self.methods = {}
        self.selected_methods = []
        self.parameters = {}
        self.parameter_values = {}
        self.output_data = None
        self.connected_to = None

    def __str__(self):
        return f"{self.class_name} ({self.component_type})"


def list_available_modules(base_package: str) -> List[str]:
    """
    List all available modules in a package.

    Args:
        base_package: The base package to search in (e.g., 'langchain_community.document_loaders')

    Returns:
        A list of available module names
    """
    try:
        # Import the base package
        package = importlib.import_module(base_package)

        # Get all modules in the package
        modules = [
            f"{base_package}.{name}"
            for _, name, ispkg in pkgutil.iter_modules(package.__path__)
        ]

        # Sort the modules alphabetically
        modules.sort()

        return modules
    except ImportError:
        print(f"Error: Could not import {base_package}")
        print("Make sure you have the required packages installed")
        return []


def list_available_classes(module_path: str) -> List[str]:
    """
    List all available classes in a module.

    Args:
        module_path: The module path to search in

    Returns:
        A list of class names in the module
    """
    try:
        module = importlib.import_module(module_path)
        classes = []

        # Get all attributes in the module
        for name in dir(module):
            # Skip private attributes
            if name.startswith("_"):
                continue

            # Get the attribute
            attr = getattr(module, name)

            # Check if it's a class and not imported from elsewhere
            if inspect.isclass(attr) and attr.__module__ == module.__name__:
                classes.append(name)

        # Sort the classes alphabetically
        classes.sort()

        return classes
    except ImportError:
        print(f"Error: Could not import {module_path}")
        return []


class RAGPipelineSimulator:
    """
    A simulator for building and executing RAG pipelines with LangChain components.
    """

    def __init__(self):
        """Initialize the RAG pipeline simulator."""
        self.blocks = []
        self.current_block_index = -1

    def clear_screen(self):
        """Clear the console screen."""
        os.system("cls" if os.name == "nt" else "clear")

    def add_block(self):
        """Add a new block to the pipeline."""
        self.clear_screen()
        print("╔═════════════════════════════════════════════╗")
        print("║          Add LangChain Block to RAG         ║")
        print("╚═════════════════════════════════════════════╝")

        # Step 1: Select component type
        print("\nSelect component type:")
        print("---------------------")
        component_types = list(RAG_COMPONENT_TYPES.keys())

        for i, component_type in enumerate(component_types, 1):
            print(f"{i}. {component_type}")

        selection = input("\nEnter component type number: ")
        try:
            type_idx = int(selection) - 1
            if type_idx < 0 or type_idx >= len(component_types):
                print("Invalid selection")
                input("\nPress Enter to continue...")
                return

            component_type = component_types[type_idx]
            base_package = RAG_COMPONENT_TYPES[component_type]

            # Step 2: Select module
            print(f"\nSelect {component_type} module:")
            print("-" * (len(component_type) + 16))

            modules = list_available_modules(base_package)

            if not modules:
                print(f"No modules found in {base_package}")
                print("Make sure you have installed the required package.")
                print("Try: pip install langchain-community")
                input("\nPress Enter to continue...")
                return

            # Display the modules with numbers
            for i, module in enumerate(modules, 1):
                # Extract the last part of the module name
                module_name = module.split(".")[-1]
                print(f"{i}. {module_name}")

            # Let the user choose a module or enter a custom one
            module_choice = input("\nEnter module number or custom module name: ")

            module_path = ""
            if module_choice.isdigit() and 1 <= int(module_choice) <= len(modules):
                # User selected from the list
                module_path = modules[int(module_choice) - 1]
            elif module_choice:
                # User entered a custom path
                if not module_choice.startswith(base_package):
                    module_path = f"{base_package}.{module_choice}"
                else:
                    module_path = module_choice
            else:
                print("No module selected")
                input("\nPress Enter to continue...")
                return

            # Step 3: Select class
            print(f"\nSelect class from {module_path}:")
            print("-" * (len(module_path) + 17))

            classes = list_available_classes(module_path)

            if not classes:
                print(f"No classes found in {module_path}")
                input("\nPress Enter to continue...")
                return

            for i, cls in enumerate(classes, 1):
                print(f"{i}. {cls}")

            class_choice = input("\nEnter class number or custom class name: ")

            if class_choice.isdigit() and 1 <= int(class_choice) <= len(classes):
                # User selected from the list
                class_name = classes[int(class_choice) - 1]
            elif class_choice:
                # User entered a custom class name
                class_name = class_choice
            else:
                print("No class selected")
                input("\nPress Enter to continue...")
                return

            # Create and add the block
            block = PipelineBlock(component_type, module_path, class_name)
            self.blocks.append(block)
            self.current_block_index = len(self.blocks) - 1

            # Discover methods and configure initialization
            self._discover_methods(self.current_block_index)

            # Auto-add init method and prompt for parameters
            if "__init__" in self.blocks[self.current_block_index].methods:
                if (
                    "__init__"
                    not in self.blocks[self.current_block_index].selected_methods
                ):
                    self.blocks[self.current_block_index].selected_methods.append(
                        "__init__"
                    )
                    print(
                        f"\n✓ Automatically added __init__ method to the {class_name} block"
                    )

                    # Prompt user to set parameters for __init__
                    print(
                        "\nLet's configure the required parameters for initialization:"
                    )
                    self._prompt_set_parameters(self.current_block_index, "__init__")

            print(f"\n✓ Added {class_name} block to the pipeline")

        except (ValueError, IndexError) as e:
            print(f"Error: {str(e)}")

        input("\nPress Enter to continue...")

    def _discover_methods(self, block_index: int) -> None:
        """
        Discover all methods in the class and their parameters.

        Args:
            block_index: Index of the block in the pipeline
        """
        block = self.blocks[block_index]

        # Define embedding parameter mappings
        embedding_param_mapping = {"embed_documents": "texts", "embed_query": "text"}

        try:
            # Import the module and get the class
            block.module = importlib.import_module(block.module_path)
            block.cls = getattr(block.module, block.class_name)

            # IMPORTANT: Special patching for embedding classes to fix parameter names
            if block.component_type == "embeddings":
                # Get the original methods for patching
                if hasattr(block.cls, "embed_documents"):
                    orig_embed_documents = block.cls.embed_documents

                    # Create a patched version with the correct parameter name
                    def patched_embed_documents(self, texts, *args, **kwargs):
                        return orig_embed_documents(self, texts, *args, **kwargs)

                    # Replace the method with our patched version
                    block.cls.embed_documents = patched_embed_documents

                if hasattr(block.cls, "embed_query"):
                    orig_embed_query = block.cls.embed_query

                    # Create a patched version with the correct parameter name
                    def patched_embed_query(self, text, *args, **kwargs):
                        return orig_embed_query(self, text, *args, **kwargs)

                    # Replace the method with our patched version
                    block.cls.embed_query = patched_embed_query

            # Get all methods
            for name, method in inspect.getmembers(
                block.cls, predicate=inspect.isfunction
            ):
                # Skip private methods except __init__
                if name.startswith("_") and name != "__init__":
                    continue

                # Get method signature
                try:
                    sig = inspect.signature(method)
                    parameters = list(sig.parameters.keys())

                    # Dynamic inspection for Pydantic models
                    if name == "__init__" and "**data" in str(sig):
                        # This is likely a Pydantic model with **data as a parameter
                        # Try different ways to get fields
                        field_parameters = []

                        # Try to create an instance to inspect its fields
                        try:
                            # Check if we can instantiate without required args
                            instance = block.cls()
                            # Get fields from the instance
                            for field_name in dir(instance):
                                if not field_name.startswith("_") and not callable(
                                    getattr(instance, field_name)
                                ):
                                    field_parameters.append(field_name)
                        except Exception:
                            pass

                        # Try Pydantic v1
                        if not field_parameters and hasattr(block.cls, "__fields__"):
                            field_parameters = list(block.cls.__fields__.keys())
                            print(f"Found Pydantic v1 fields: {field_parameters}")

                        # Try Pydantic v2
                        if not field_parameters and hasattr(block.cls, "model_fields"):
                            field_parameters = list(block.cls.model_fields.keys())
                            print(f"Found Pydantic v2 fields: {field_parameters}")

                        # Try __annotations__ as a fallback
                        if not field_parameters and hasattr(
                            block.cls, "__annotations__"
                        ):
                            field_parameters = list(block.cls.__annotations__.keys())
                            print(f"Found annotations: {field_parameters}")

                        # Look at constructor parameters through source code inspection as last resort
                        if not field_parameters:
                            try:
                                source = inspect.getsource(block.cls.__init__)
                                # Look for self.XXX = XXX patterns in constructor
                                import re

                                matches = re.findall(
                                    r"self\.([a-zA-Z0-9_]+)\s*=", source
                                )
                                if matches:
                                    field_parameters = matches
                                    print(
                                        f"Found fields via source inspection: {field_parameters}"
                                    )
                            except Exception:
                                pass

                        if field_parameters:
                            parameters = ["self"] + field_parameters
                            print(f"Using dynamic field inspection: {parameters}")
                        else:
                            print(
                                f"Warning: Could not dynamically find fields for {block.class_name}"
                            )

                    # Force rename any 'data' parameters for embedding methods
                    if (
                        block.component_type == "embeddings"
                        and name in embedding_param_mapping
                    ):
                        for i, param in enumerate(parameters):
                            if param == "data":
                                parameters[i] = embedding_param_mapping[name]

                    # Only create a new signature for methods we have mappings for
                    if "data" in sig.parameters and name in embedding_param_mapping:
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

                        # Create new signature with corrected parameters
                        sig = sig.replace(parameters=new_params)

                    block.methods[name] = {
                        "signature": sig,
                        "parameters": parameters,
                        "return_annotation": sig.return_annotation,
                        "doc": inspect.getdoc(method) or "No documentation available",
                    }

                    # Store parameters separately for easier access
                    block.parameters[name] = parameters

                    # Initialize parameter values
                    for param in block.parameters[name]:
                        if param not in block.parameter_values:
                            block.parameter_values[param] = None

                except ValueError:
                    print(f"Warning: Could not inspect method {name}")

        except ImportError:
            print(f"Error: Could not import {block.module_path}")
            print("Make sure you have installed the required dependencies.")
        except AttributeError:
            print(f"Error: Class {block.class_name} not found in {block.module_path}")

    def _prompt_set_parameters(self, block_index: int, method_name: str) -> None:
        """
        Prompt the user to set parameters for a specific method.

        Args:
            block_index: Index of the block in the pipeline
            method_name: Name of the method to set parameters for
        """
        block = self.blocks[block_index]

        if method_name not in block.methods:
            print(f"Method {method_name} not found")
            return

        params = block.parameters[method_name]

        # Check if there are any parameters other than self
        has_params = False
        for param in params:
            if param != "self":
                has_params = True
                break

        if not has_params:
            print(f"No parameters to set for {method_name}")
            return

        print(f"\nParameters for {method_name}:")
        print("-" * (15 + len(method_name)))

        # Define embedding parameter mappings
        embedding_param_mapping = {"embed_documents": "texts", "embed_query": "text"}

        for param in params:
            if param == "self":
                continue

            # Handle special case for embeddings' data parameter
            display_param = param
            if block.component_type == "embeddings" and param == "data":
                if method_name in embedding_param_mapping:
                    display_param = embedding_param_mapping[method_name]
                    # Also update the parameter in the block's parameters
                    idx = block.parameters[method_name].index(param)
                    block.parameters[method_name][idx] = display_param

            # Get parameter details if available
            param_doc = ""
            param_info = None

            # Extract parameter info from docstring if available
            if block.methods[method_name]["doc"]:
                doc_lines = block.methods[method_name]["doc"].split("\n")
                for i, line in enumerate(doc_lines):
                    if f"{param}:" in line or f"{param} :" in line:
                        param_doc = line.split(":", 1)[1].strip()
                        break

            # Try to get default value
            try:
                param_obj = block.methods[method_name]["signature"].parameters[param]
                if param_obj.default is not inspect.Parameter.empty:
                    param_info = f" (default: {param_obj.default})"
            except Exception:
                pass

            info_str = f" - {param_doc}" if param_doc else ""
            default_str = param_info if param_info else ""

            if info_str or default_str:
                print(f"  {display_param}{default_str}{info_str}")

            current_value = block.parameter_values.get(display_param, None)
            value = input(f"  {display_param} [{current_value}]: ")

            if value:  # Only update if a value was entered
                # Store the value under the correct parameter name
                block.parameter_values[display_param] = value
                # Remove the old parameter name if it exists
                if display_param != param and param in block.parameter_values:
                    del block.parameter_values[param]

        print(f"✓ Parameters updated for {method_name}")

    def remove_block(self):
        """Remove a block from the pipeline."""
        if not self.blocks:
            print("No blocks in the pipeline")
            input("\nPress Enter to continue...")
            return

        self.clear_screen()
        print("╔═════════════════════════════════════════════╗")
        print("║          Remove Block from Pipeline         ║")
        print("╚═════════════════════════════════════════════╝")

        print("\nCurrent blocks in pipeline:")
        print("--------------------------")
        for i, block in enumerate(self.blocks, 1):
            print(f"{i}. {block}")

        try:
            selection = input("\nEnter block number to remove (or 0 to cancel): ")
            if selection == "0":
                return

            idx = int(selection) - 1
            if idx < 0 or idx >= len(self.blocks):
                print("Invalid selection")
                input("\nPress Enter to continue...")
                return

            # Remove the block
            removed_block = self.blocks.pop(idx)
            print(f"✓ Removed {removed_block} from the pipeline")

            # Update current block index
            if self.blocks:
                self.current_block_index = min(idx, len(self.blocks) - 1)
            else:
                self.current_block_index = -1

            # Update connections
            self._update_connections_after_removal(idx)

        except (ValueError, IndexError):
            print("Invalid selection")

        input("\nPress Enter to continue...")

    def _update_connections_after_removal(self, removed_idx: int):
        """Update connections after a block is removed."""
        for i, block in enumerate(self.blocks):
            if block.connected_to is not None:
                if block.connected_to == removed_idx:
                    # This block was connected to the removed block, disconnect it
                    block.connected_to = None
                elif block.connected_to > removed_idx:
                    # This block was connected to a block after the removed block, update the index
                    block.connected_to -= 1

    def select_block(self):
        """Select a block to work with."""
        if not self.blocks:
            print("No blocks in the pipeline")
            input("\nPress Enter to continue...")
            return

        self.clear_screen()
        print("╔═════════════════════════════════════════════╗")
        print("║             Select Block to Edit            ║")
        print("╚═════════════════════════════════════════════╝")

        print("\nBlocks in pipeline:")
        print("------------------")
        for i, block in enumerate(self.blocks, 1):
            marker = "→" if i - 1 == self.current_block_index else " "
            print(f"{marker} {i}. {block}")

        try:
            selection = input("\nEnter block number (or 0 to cancel): ")
            if selection == "0":
                return

            idx = int(selection) - 1
            if idx < 0 or idx >= len(self.blocks):
                print("Invalid selection")
                input("\nPress Enter to continue...")
                return

            self.current_block_index = idx
            print(f"✓ Selected {self.blocks[idx]}")

        except (ValueError, IndexError):
            print("Invalid selection")

        input("\nPress Enter to continue...")

    def connect_blocks(self):
        """Connect blocks in the pipeline."""
        if len(self.blocks) < 2:
            print("Need at least 2 blocks to create connections")
            input("\nPress Enter to continue...")
            return

        self.clear_screen()
        print("╔═════════════════════════════════════════════╗")
        print("║           Connect Pipeline Blocks           ║")
        print("╚═════════════════════════════════════════════╝")

        # Display current connections
        print("\nCurrent pipeline connections:")
        print("---------------------------")
        for i, block in enumerate(self.blocks):
            connection = (
                " → " + str(self.blocks[block.connected_to])
                if block.connected_to is not None
                else ""
            )
            print(f"{i+1}. {block}{connection}")

        # Select source block
        source_idx = -1
        while True:
            try:
                source = input("\nSelect source block (or 0 to cancel): ")
                if source == "0":
                    return

                source_idx = int(source) - 1
                if source_idx < 0 or source_idx >= len(self.blocks):
                    print("Invalid selection")
                    continue

                break

            except ValueError:
                print("Invalid input. Please enter a number.")

        # Select target block
        while True:
            try:
                target = input(
                    f"Connect {self.blocks[source_idx]} to which block? (or 0 to cancel): "
                )
                if target == "0":
                    return

                target_idx = int(target) - 1
                if target_idx < 0 or target_idx >= len(self.blocks):
                    print("Invalid selection")
                    continue

                if target_idx == source_idx:
                    print("Cannot connect a block to itself")
                    continue

                # Create the connection
                self.blocks[source_idx].connected_to = target_idx
                print(
                    f"✓ Connected {self.blocks[source_idx]} → {self.blocks[target_idx]}"
                )
                break

            except ValueError:
                print("Invalid input. Please enter a number.")

        input("\nPress Enter to continue...")

    def manage_current_block(self):
        """Manage methods and parameters of the current block."""
        if self.current_block_index < 0 or self.current_block_index >= len(self.blocks):
            print("No block selected")
            input("\nPress Enter to continue...")
            return

        block = self.blocks[self.current_block_index]

        while True:
            self.clear_screen()

            # Calculate the width of the box based on the class name
            width = max(60, len(block.class_name) + 20)

            # Display the header
            print("╔" + "═" * width + "╗")
            print(
                "║"
                + f" {block.class_name} Block ({block.component_type}) ".center(width)
                + "║"
            )
            print("╠" + "═" * width + "╣")

            # Display methods
            if not block.methods:
                print("║" + " No methods available ".center(width) + "║")
            else:
                for i, (name, info) in enumerate(block.methods.items(), 1):
                    # Mark selected methods with an asterisk and highlight
                    selected = "→ " if name in block.selected_methods else "  "

                    # Truncate long method signatures for display
                    param_str = ", ".join(info["parameters"])
                    if len(param_str) > width - 15:
                        param_str = param_str[: width - 18] + "..."

                    # Show method with parameters
                    print(f"║ {i}. {selected}{name}({param_str})")

                    # If selected, show a bit of documentation in a lighter color
                    if name in block.selected_methods:
                        # Get first line of docstring
                        doc = (
                            info["doc"].split("\n")[0]
                            if info["doc"]
                            else "No documentation"
                        )
                        if len(doc) > width - 10:
                            doc = doc[: width - 13] + "..."
                        print(f"║    └─ {doc}")

            print("╠" + "═" * width + "╣")
            print("║" + " Commands ".center(width) + "║")
            print(
                "║"
                + " [a] Add Method | [r] Remove Method | [p] Set Parameters ".center(
                    width
                )
                + "║"
            )
            print(
                "║"
                + " [d] Method Details | [b] Back to Pipeline View ".center(width)
                + "║"
            )
            print("╚" + "═" * width + "╝")

            # Show current configuration if methods are selected
            if block.selected_methods:
                print("\nCurrent Configuration:")
                print("---------------------")

                # Show parameters that have been set
                params_set = False
                for param, value in block.parameter_values.items():
                    if value is not None:
                        print(f"  {param} = {value}")
                        params_set = True

                if not params_set:
                    print("  No parameters set yet. Use [p] to set parameters.")

            choice = input("\nEnter command: ").lower()

            if choice == "a":
                self._add_method_to_block()
            elif choice == "r":
                self._remove_method_from_block()
            elif choice == "p":
                self._set_parameters_for_block()
            elif choice == "d":
                self._show_method_details()
            elif choice == "b":
                break
            else:
                print("Invalid command")
                input("\nPress Enter to continue...")

    def _add_method_to_block(self):
        """Add a method to the selected methods list of the current block."""
        block = self.blocks[self.current_block_index]

        if not block.methods:
            print("No methods available")
            input("\nPress Enter to continue...")
            return

        print("\nAvailable methods:")
        print("------------------")
        for i, name in enumerate(block.methods.keys(), 1):
            print(f"{i}. {name}")

        try:
            selection = input("\nEnter method number to add (or 0 to cancel): ")
            if selection == "0":
                return

            idx = int(selection) - 1
            method_name = list(block.methods.keys())[idx]

            if method_name not in block.selected_methods:
                block.selected_methods.append(method_name)
                print(f"✓ Added method: {method_name}")
            else:
                print(f"⚠ Method {method_name} already selected")
        except (ValueError, IndexError):
            print("⚠ Invalid selection")

        input("\nPress Enter to continue...")

    def _remove_method_from_block(self):
        """Remove a method from the selected methods list of the current block."""
        block = self.blocks[self.current_block_index]

        if not block.selected_methods:
            print("No methods selected")
            input("\nPress Enter to continue...")
            return

        print("\nSelected methods:")
        print("----------------")
        for i, name in enumerate(block.selected_methods, 1):
            print(f"{i}. {name}")

        try:
            selection = input("\nEnter method number to remove (or 0 to cancel): ")
            if selection == "0":
                return

            idx = int(selection) - 1
            method_name = block.selected_methods[idx]
            block.selected_methods.remove(method_name)
            print(f"✓ Removed method: {method_name}")
        except (ValueError, IndexError):
            print("⚠ Invalid selection")

        input("\nPress Enter to continue...")

    def _set_parameters_for_block(self):
        """Set parameter values for the selected methods in the current block."""
        block = self.blocks[self.current_block_index]

        if not block.selected_methods:
            print("No methods selected")
            input("\nPress Enter to continue...")
            return

        print("\nSet parameters for which method?")
        print("-------------------------------")
        for i, name in enumerate(block.selected_methods, 1):
            print(f"{i}. {name}")

        try:
            selection = input("\nEnter method number (or 0 to cancel): ")
            if selection == "0":
                return

            idx = int(selection) - 1
            method_name = block.selected_methods[idx]

            # Use the common method for setting parameters
            self._prompt_set_parameters(self.current_block_index, method_name)

        except (ValueError, IndexError):
            print("⚠ Invalid selection")

        input("\nPress Enter to continue...")

    def _show_method_details(self):
        """Show detailed information about a method in the current block."""
        block = self.blocks[self.current_block_index]

        if not block.methods:
            print("No methods available")
            input("\nPress Enter to continue...")
            return

        print("\nAvailable methods:")
        print("------------------")
        for i, name in enumerate(block.methods.keys(), 1):
            status = "[Selected]" if name in block.selected_methods else ""
            print(f"{i}. {name} {status}")

        try:
            selection = input("\nEnter method number for details (or 0 to cancel): ")
            if selection == "0":
                return

            idx = int(selection) - 1
            method_name = list(block.methods.keys())[idx]
            method_info = block.methods[method_name]

            self.clear_screen()
            print(f"\nMethod Details: {method_name}")
            print("=" * (15 + len(method_name)))

            # Display signature
            params = []
            for param_name, param in method_info["signature"].parameters.items():
                if param.default != inspect.Parameter.empty:
                    params.append(f"{param_name}={param.default}")
                else:
                    params.append(param_name)

            print(f"\nSignature: {method_name}({', '.join(params)})")

            # Display return type
            return_type = method_info["return_annotation"]
            if return_type != inspect.Signature.empty:
                print(f"Returns: {return_type}")
            else:
                print("Returns: Not specified")

            # Display documentation
            print("\nDocumentation:")
            print(f"{method_info['doc']}")

            # Display parameters
            print("\nParameters:")
            for param_name in method_info["parameters"]:
                current_value = block.parameter_values.get(param_name, None)
                value_str = f" = {current_value}" if current_value is not None else ""
                print(f"  - {param_name}{value_str}")

        except (ValueError, IndexError):
            print("⚠ Invalid selection")

        input("\nPress Enter to continue...")

    def _convert_parameter_value(self, value: str) -> Any:
        """Convert a string parameter value to the appropriate Python type."""
        if value is None:
            return None

        # Handle boolean values
        if value.lower() == "true":
            return True
        elif value.lower() == "false":
            return False
        elif value.lower() == "none":
            return None

        # Handle numeric values
        try:
            if value.isdigit():
                return int(value)
            if "." in value and all(part.isdigit() for part in value.split(".", 1)):
                return float(value)
        except Exception:
            pass

        # Handle list/dict syntax
        if (value.startswith("[") and value.endswith("]")) or (
            value.startswith("{") and value.endswith("}")
        ):
            try:
                return eval(value)  # Note: This should be used cautiously
            except Exception:
                pass

        # Default to string
        return value

    def _topological_sort(self) -> List[int]:
        """
        Perform a topological sort on the pipeline blocks based on connections.
        Returns a list of block indices in execution order.
        """
        # Create a graph representation
        graph = {}
        for i, block in enumerate(self.blocks):
            graph[i] = []

        # Add edges
        for i, block in enumerate(self.blocks):
            if block.connected_to is not None:
                graph[block.connected_to].append(
                    i
                )  # Reverse the edge for topological sort

        # Find all nodes with no incoming edges (i.e., end nodes in our pipeline)
        end_nodes = []
        for i in range(len(self.blocks)):
            has_outgoing = False
            for j in range(len(self.blocks)):
                if i in graph[j]:
                    has_outgoing = True
                    break
            if not has_outgoing:
                end_nodes.append(i)

        # If no end nodes, there might be a cycle
        if not end_nodes:
            # Try to find any node to start with
            end_nodes = [0]

        # Run topological sort
        visited = set()
        temp = set()
        order = []

        def visit(node):
            if node in temp:
                return False  # Cycle detected
            if node in visited:
                return True

            temp.add(node)

            for neighbor in graph[node]:
                if not visit(neighbor):
                    return False

            temp.remove(node)
            visited.add(node)
            order.append(node)
            return True

        # Visit all end nodes
        for node in end_nodes:
            if not visit(node):
                return []

        # Add any remaining nodes (in case of disconnected components)
        for i in range(len(self.blocks)):
            if i not in visited:
                if not visit(i):
                    return []

        # Reverse to get correct order
        order.reverse()
        return order

    def run_pipeline(self) -> None:
        """Run the entire pipeline with data flowing between blocks."""
        if not self.blocks:
            print("No blocks in the pipeline")
            input("\nPress Enter to continue...")
            return

        self.clear_screen()
        print("╔═════════════════════════════════════════════╗")
        print("║               Running Pipeline              ║")
        print("╚═════════════════════════════════════════════╝")

        # Check if we have any connections
        has_connections = False
        for block in self.blocks:
            if block.connected_to is not None:
                has_connections = True
                break

        if not has_connections:
            print("\n⚠ No connections between blocks. Use [c] to connect blocks first.")
            input("\nPress Enter to continue...")
            return

        # Validate that all blocks have __init__ and required parameters
        for i, block in enumerate(self.blocks):
            if "__init__" not in block.methods:
                continue  # Some classes might not have __init__

            missing_params = []
            for param in block.parameters["__init__"]:
                if param != "self" and block.parameter_values.get(param) is None:
                    # Check if parameter is required (no default value)
                    param_obj = block.methods["__init__"]["signature"].parameters[param]
                    if param_obj.default is inspect.Parameter.empty:
                        missing_params.append(param)

            if missing_params:
                print(f"\n⚠ Block {i+1} ({block}) is missing required parameters:")
                for param in missing_params:
                    print(f"  - {param}")

                set_now = input(
                    "\nWould you like to set these parameters now? (y/n): "
                ).lower()
                if set_now == "y":
                    self.current_block_index = i
                    self._prompt_set_parameters(i, "__init__")
                else:
                    print("Cannot run pipeline without required parameters.")
                    input("\nPress Enter to continue...")
                    return

        print("\n▶ Running RAG pipeline...\n")
        print("=" * 50)

        # Topologically sort blocks based on connections
        execution_order = self._topological_sort()

        if not execution_order:
            print(
                "\n⚠ Could not determine execution order. Check for circular dependencies."
            )
            input("\nPress Enter to continue...")
            return

        # Initialize instances and execute methods
        try:
            # First, create all instances
            for block_idx in execution_order:
                block = self.blocks[block_idx]

                # Create instance using __init__ parameters
                if "__init__" in block.methods:
                    print(f"📦 Creating {block.class_name} instance...")

                    # Build parameters dict for initialization
                    init_params = {}
                    for param in block.parameters["__init__"]:
                        if (
                            param != "self"
                            and param in block.parameter_values
                            and block.parameter_values[param] is not None
                        ):
                            value = self._convert_parameter_value(
                                block.parameter_values[param]
                            )
                            init_params[param] = value

                    # Special handling for parameters that need other block outputs
                    for param, value in init_params.items():
                        if isinstance(value, str) and value.startswith("block:"):
                            # Extract block index
                            try:
                                ref_block_idx = int(value.split(":", 1)[1]) - 1
                                if (
                                    0 <= ref_block_idx < len(self.blocks)
                                    and self.blocks[ref_block_idx].output_data
                                    is not None
                                ):
                                    init_params[param] = self.blocks[
                                        ref_block_idx
                                    ].output_data
                            except Exception:
                                pass

                    # Create the instance
                    block.instance = block.cls(**init_params)
                    print(f"✓ {block.class_name} instance created successfully")
                else:
                    # Some classes don't have __init__, just use the class directly
                    block.instance = block.cls
                    print(
                        f"✓ Using {block.class_name} directly (no initialization required)"
                    )

            # Now execute methods in order
            for block_idx in execution_order:
                block = self.blocks[block_idx]

                # Skip if there are no methods to execute
                if not block.selected_methods or (
                    len(block.selected_methods) == 1
                    and block.selected_methods[0] == "__init__"
                ):
                    continue

                print(f"\n▶ Executing methods for {block.class_name}...")

                # Get the instance
                instance = block.instance

                # Execute each selected method except __init__
                for method_name in block.selected_methods:
                    if method_name == "__init__":
                        continue  # Skip init as we've already used it

                    # Build parameter dictionary for this method
                    method_params = {}
                    for param in block.parameters[method_name]:
                        if (
                            param != "self"
                            and param in block.parameter_values
                            and block.parameter_values[param] is not None
                        ):
                            value = self._convert_parameter_value(
                                block.parameter_values[param]
                            )
                            method_params[param] = value

                    # Special handling for parameters that need other block outputs
                    for param, value in method_params.items():
                        if isinstance(value, str) and value.startswith("block:"):
                            # Extract block index
                            try:
                                ref_block_idx = int(value.split(":", 1)[1]) - 1
                                if (
                                    0 <= ref_block_idx < len(self.blocks)
                                    and self.blocks[ref_block_idx].output_data
                                    is not None
                                ):
                                    method_params[param] = self.blocks[
                                        ref_block_idx
                                    ].output_data
                            except Exception:
                                pass

                    # Call the method
                    print(f"🔄 Calling {method_name}()...")
                    method = getattr(instance, method_name)
                    result = method(**method_params)

                    # Store the result as this block's output
                    block.output_data = result

                    # Display result preview
                    print("✓ Method completed successfully")
                    print("📄 Result preview:")

                    # Handle different result types
                    if hasattr(result, "__len__"):
                        print(f"  Result type: {type(result).__name__}")
                        print(f"  Result length: {len(result)} items")

                        # If it's a list of documents, show a sample
                        if len(result) > 0:
                            if hasattr(result[0], "page_content"):
                                # It's likely a document with page_content
                                print("\n📑 Document sample:")
                                print("-" * 40)
                                sample_text = result[0].page_content[:500]
                                print(
                                    sample_text
                                    + (
                                        "..."
                                        if len(result[0].page_content) > 500
                                        else ""
                                    )
                                )
                                print("-" * 40)

                                if len(result) > 1:
                                    print(
                                        f"\nAnd {len(result)-1} more document(s)...\n"
                                    )
                            else:
                                # It's some other kind of list, show the first item
                                print("\n📋 Sample item:")
                                print("-" * 40)
                                print(
                                    str(result[0])[:500]
                                    + ("..." if len(str(result[0])) > 500 else "")
                                )
                                print("-" * 40)
                    else:
                        # It's not a collection, just show the result directly
                        print(f"  Result type: {type(result).__name__}")
                        result_str = str(result)
                        print("-" * 40)
                        print(
                            result_str[:500] + ("..." if len(result_str) > 500 else "")
                        )
                        print("-" * 40)

                # If this block has a connection, pass the output data to the next block
                if block.connected_to is not None:
                    next_block = self.blocks[block.connected_to]
                    print(f"\n🔄 Passing output data to {next_block.class_name}...")

            print("\n" + "=" * 50)
            print("✅ RAG Pipeline execution completed successfully")

        except Exception as e:
            print(f"\n❌ Error during pipeline execution: {str(e)}")
            print(f"Error type: {type(e).__name__}")
            import traceback

            print("\nDetailed error information:")
            print("-" * 50)
            traceback.print_exc()
            print("-" * 50)

        input("\nPress Enter to continue...")

    def generate_code(self) -> None:
        """Generate executable Python code for the configured RAG pipeline."""
        if not self.blocks:
            print("No blocks in the pipeline")
            input("\nPress Enter to continue...")
            return

        # Define method categories for proper ordering
        producer_methods = ["load", "create_docs", "get_docs"]
        consumer_methods = [
            "split_documents",
            "from_documents",
            "add_documents",
            "embed_documents",
            "embed_query",
        ]

        # Define natural order of component types based on data flow
        component_type_order = [
            "document_loaders",  # First: document loaders produce documents
            "text_splitters",  # Second: text splitters process documents
            "embeddings",  # Third: embeddings convert documents to vectors
            "vectorstores",  # Fourth: vectorstores store embeddings
            "retrievers",  # Fifth: retrievers search vectorstores
            "llms",  # Sixth: LLMs generate text from context
            "chat_models",  # Seventh: Chat models interact with context
            "prompts",  # Eighth: Prompts format data
            "output_parsers",  # Ninth: Output parsers structure responses
            "chains",  # Tenth: Chains orchestrate everything
        ]

        # Mapping for embedding method parameter names
        embedding_param_mapping = {"embed_documents": "texts", "embed_query": "text"}

        self.clear_screen()
        print("╔═════════════════════════════════════════════╗")
        print("║           Generate Pipeline Code            ║")
        print("╚═════════════════════════════════════════════╝")

        # Check if we have any connections
        has_connections = False
        for block in self.blocks:
            if block.connected_to is not None:
                has_connections = True
                break

        if not has_connections and len(self.blocks) > 1:
            print(
                "\n⚠ Warning: No connections between blocks. Use [c] to connect blocks first."
            )
            print("   The generated code will not represent a complete pipeline.")

        # Get execution order based on connections if they exist
        if has_connections:
            topo_order = self._topological_sort()
            if not topo_order:
                print(
                    "\n⚠ Could not determine execution order. Check for circular dependencies."
                )
                input("\nPress Enter to continue...")
                return
        else:
            # If no connections, just use the order they were added
            topo_order = list(range(len(self.blocks)))

        # Now reorder by component type to respect natural data flow
        execution_order = []
        for component_type in component_type_order:
            # Add blocks of this component type while preserving their relative order
            type_blocks = [
                idx
                for idx in topo_order
                if self.blocks[idx].component_type == component_type
            ]
            execution_order.extend(type_blocks)

        # Add any blocks with component types not in our predefined order
        for idx in topo_order:
            if idx not in execution_order:
                execution_order.append(idx)

        # Build connection maps
        connection_map = {}
        for i, block in enumerate(self.blocks):
            if block.connected_to is not None:
                if i not in connection_map:
                    connection_map[i] = []
                connection_map[i].append(block.connected_to)

        reverse_connection_map = {}
        for i, block in enumerate(self.blocks):
            if block.connected_to is not None:
                target = block.connected_to
                if target not in reverse_connection_map:
                    reverse_connection_map[target] = []
                reverse_connection_map[target].append(i)

        print("\n=== Generated Python Code ===\n")

        # Import statements
        imports = set()
        for block in self.blocks:
            imports.add(f"import {block.module_path}")

        for imp in sorted(list(imports)):
            print(imp)

        print("\n# RAG Pipeline Setup")

        # Create variable names for each block
        block_vars = {}
        for i, block_idx in enumerate(execution_order):
            block = self.blocks[block_idx]
            var_name = f"{block.class_name.lower()}_{i+1}".replace(" ", "_")
            block_vars[block_idx] = var_name

        # First, handle all block initializations in the proper order
        init_code_lines = []

        for i, block_idx in enumerate(execution_order):
            block = self.blocks[block_idx]
            var_name = block_vars[block_idx]

            self._ensure_common_methods(block_idx)

            # Build initialization parameters string
            init_params = []
            if "__init__" in block.methods:
                # Special handling for text splitters
                if block.component_type == "text_splitters":
                    if "split_documents" in block.parameters:
                        for param in ["chunk_size", "chunk_overlap", "length_function"]:
                            if (
                                param in block.parameter_values
                                and block.parameter_values[param] is not None
                            ):
                                value = block.parameter_values[param]
                                if isinstance(value, str):
                                    if value.isdigit():
                                        # It's a number, don't quote it
                                        pass
                                    elif not (
                                        value.startswith(
                                            (
                                                "'",
                                                '"',
                                                "[",
                                                "{",
                                                "True",
                                                "False",
                                                "None",
                                            )
                                        )
                                    ):
                                        value = f'"{value}"'
                                init_params.append(f"{param}={value}")

                # Normal parameter handling for init
                for param in block.parameters["__init__"]:
                    if (
                        param != "self"
                        and param in block.parameter_values
                        and block.parameter_values[param] is not None
                    ):
                        value = block.parameter_values[param]

                        # Format the value properly
                        if isinstance(value, str):
                            # Handle file paths
                            if "\\" in value or "/" in value:
                                value = self._normalize_path(value)
                                value = f'"{value}"'
                            # Handle block references
                            elif value.startswith("block:"):
                                try:
                                    ref_block_idx = int(value.split(":", 1)[1]) - 1
                                    if 0 <= ref_block_idx < len(self.blocks):
                                        value = block_vars[ref_block_idx] + "_output"
                                except Exception:
                                    if not (
                                        value.startswith(
                                            (
                                                "'",
                                                '"',
                                                "[",
                                                "{",
                                                "True",
                                                "False",
                                                "None",
                                            )
                                        )
                                        or value.isdigit()
                                    ):
                                        value = f'"{value}"'
                            # Regular strings
                            elif not (
                                value.startswith(
                                    ("'", '"', "[", "{", "True", "False", "None")
                                )
                                or value.isdigit()
                            ):
                                value = f'"{value}"'

                        init_params.append(f"{param}={value}")

            init_code_lines.append(f"\n# Initialize {block.class_name}")
            init_code_lines.append(
                f"{var_name} = {block.module_path}.{block.class_name}({', '.join(init_params)})"
            )

        # Now generate method execution code in the correct order
        method_code_lines = []

        # First run all producer methods like load() in the execution order we determined
        for block_idx in execution_order:
            block = self.blocks[block_idx]
            var_name = block_vars[block_idx]

            # Get methods for this block (excluding __init__)
            methods_to_execute = [m for m in block.selected_methods if m != "__init__"]

            # Run producer methods first
            producer_methods_for_block = [
                m for m in methods_to_execute if m in producer_methods
            ]

            for method_name in producer_methods_for_block:
                # Build method parameters
                method_params = []
                param_dict = {}

                # Handle embedding methods with proper parameter names
                if (
                    block.component_type == "embeddings"
                    and method_name in embedding_param_mapping
                ):
                    # Get the correct parameter name for this embedding method
                    correct_param = embedding_param_mapping[method_name]

                    # Check if user-defined parameters exist and convert them
                    has_user_params = False
                    for param in block.parameters[method_name]:
                        if (
                            param != "self"
                            and param in block.parameter_values
                            and block.parameter_values[param] is not None
                        ):
                            value = block.parameter_values[param]

                            # CRITICAL FIX: Ensure any 'data' parameter is renamed to the correct name
                            if param == "data":
                                param = correct_param

                            # Process parameter value
                            if isinstance(value, str):
                                if value.startswith("block:"):
                                    try:
                                        ref_block_idx = int(value.split(":", 1)[1]) - 1
                                        if 0 <= ref_block_idx < len(self.blocks):
                                            ref_var = block_vars[ref_block_idx]
                                            value = f"{ref_var}_output"
                                    except Exception:
                                        if not (
                                            value.startswith(
                                                (
                                                    "'",
                                                    '"',
                                                    "[",
                                                    "{",
                                                    "True",
                                                    "False",
                                                    "None",
                                                )
                                            )
                                            or value.isdigit()
                                        ):
                                            value = f'"{value}"'
                                elif "\\" in value or "/" in value:
                                    value = self._normalize_path(value)
                                    value = f'"{value}"'
                                elif not (
                                    value.startswith(
                                        ("'", '"', "[", "{", "True", "False", "None")
                                    )
                                    or value.isdigit()
                                ):
                                    value = f'"{value}"'

                            param_dict[param] = value
                            method_params.append(f"{param}={value}")
                            has_user_params = True

                    # If no parameters were specified, check for connections
                    if not has_user_params:
                        if block_idx in reverse_connection_map:
                            for source_idx in reverse_connection_map[block_idx]:
                                source_var = block_vars[source_idx]
                                method_code_lines.append(
                                    f"\n# Execute {method_name} on {block.class_name}"
                                )
                                method_code_lines.append(
                                    f"{var_name}_output = {var_name}.{method_name}({correct_param}={source_var}_output)"
                                )
                                break
                        else:
                            # No connection, use default value
                            default_value = (
                                "['This is a sample document for embedding.']"
                                if correct_param == "texts"
                                else "'What information do you have?'"
                            )
                            method_code_lines.append(
                                f"\n# Execute {method_name} on {block.class_name}"
                            )
                            method_code_lines.append(
                                f"{var_name}_output = {var_name}.{method_name}({correct_param}={default_value})"
                            )
                    else:
                        # Use the user-defined parameters with correct naming
                        method_code_lines.append(
                            f"\n# Execute {method_name} on {block.class_name}"
                        )
                        method_code_lines.append(
                            f"{var_name}_output = {var_name}.{method_name}({', '.join(method_params)})"
                        )
                else:
                    # Normal parameter handling for non-embedding methods
                    for param in block.parameters[method_name]:
                        if (
                            param != "self"
                            and param in block.parameter_values
                            and block.parameter_values[param] is not None
                        ):
                            value = block.parameter_values[param]

                            # Process parameter value
                            if isinstance(value, str):
                                if value.startswith("block:"):
                                    try:
                                        ref_block_idx = int(value.split(":", 1)[1]) - 1
                                        if 0 <= ref_block_idx < len(self.blocks):
                                            ref_var = block_vars[ref_block_idx]
                                            value = f"{ref_var}_output"
                                    except Exception:
                                        if not (
                                            value.startswith(
                                                (
                                                    "'",
                                                    '"',
                                                    "[",
                                                    "{",
                                                    "True",
                                                    "False",
                                                    "None",
                                                )
                                            )
                                            or value.isdigit()
                                        ):
                                            value = f'"{value}"'
                                elif "\\" in value or "/" in value:
                                    value = self._normalize_path(value)
                                    value = f'"{value}"'
                                elif not (
                                    value.startswith(
                                        ("'", '"', "[", "{", "True", "False", "None")
                                    )
                                    or value.isdigit()
                                ):
                                    value = f'"{value}"'

                            param_dict[param] = value
                            method_params.append(f"{param}={value}")

                    method_code_lines.append(
                        f"\n# Execute {method_name} on {block.class_name}"
                    )
                    method_code_lines.append(
                        f"{var_name}_output = {var_name}.{method_name}({', '.join(method_params)})"
                    )

        # Then run all consumer methods
        for block_idx in execution_order:
            block = self.blocks[block_idx]
            var_name = block_vars[block_idx]

            # Get methods for this block (excluding __init__ and producer methods)
            methods_to_execute = [
                m
                for m in block.selected_methods
                if m != "__init__" and m not in producer_methods
            ]

            # For embeddings, only include embed_documents (not both embed methods)
            if block.component_type == "embeddings":
                if (
                    "embed_documents" in methods_to_execute
                    and "embed_query" in methods_to_execute
                ):
                    # If both are present, only keep embed_documents
                    methods_to_execute.remove("embed_query")

            for method_name in methods_to_execute:
                # Build method parameters
                method_params = []
                param_dict = {}

                # Special handling for embedding methods to ensure proper parameter names
                if (
                    block.component_type == "embeddings"
                    and method_name in embedding_param_mapping
                ):
                    correct_param = embedding_param_mapping[method_name]

                    has_user_params = False
                    for param in block.parameters[method_name]:
                        if (
                            param != "self"
                            and param in block.parameter_values
                            and block.parameter_values[param] is not None
                        ):
                            value = block.parameter_values[param]

                            # CRITICAL FIX: Convert 'data' parameter to the correct name
                            if param == "data":
                                param = correct_param

                            # Process parameter value
                            if isinstance(value, str):
                                if value.startswith("block:"):
                                    try:
                                        ref_block_idx = int(value.split(":", 1)[1]) - 1
                                        if 0 <= ref_block_idx < len(self.blocks):
                                            ref_var = block_vars[ref_block_idx]
                                            value = f"{ref_var}_output"
                                    except Exception:
                                        if not (
                                            value.startswith(
                                                (
                                                    "'",
                                                    '"',
                                                    "[",
                                                    "{",
                                                    "True",
                                                    "False",
                                                    "None",
                                                )
                                            )
                                            or value.isdigit()
                                        ):
                                            value = f'"{value}"'
                                elif "\\" in value or "/" in value:
                                    value = self._normalize_path(value)
                                    value = f'"{value}"'
                                elif not (
                                    value.startswith(
                                        ("'", '"', "[", "{", "True", "False", "None")
                                    )
                                    or value.isdigit()
                                ):
                                    value = f'"{value}"'

                            param_dict[param] = value
                            method_params.append(f"{param}={value}")
                            has_user_params = True

                    method_code_lines.append(
                        f"\n# Execute {method_name} on {block.class_name}"
                    )

                    # Check if this method has incoming connections
                    if block_idx in reverse_connection_map and not has_user_params:
                        source_block_indices = reverse_connection_map[block_idx]
                        if source_block_indices:
                            source_var = block_vars[source_block_indices[0]]
                            # CRITICAL FIX: Use correct parameter name
                            method_code_lines.append(
                                f"{var_name}_output = {var_name}.{method_name}({correct_param}={source_var}_output)"
                            )
                        else:
                            # No connection, use default value with correct parameter name
                            default_value = (
                                "['This is a sample document for embedding.']"
                                if correct_param == "texts"
                                else "'What information do you have?'"
                            )
                            method_code_lines.append(
                                f"{var_name}_output = {var_name}.{method_name}({correct_param}={default_value})"
                            )
                    else:
                        # Use the parameters directly - they've been corrected above
                        method_code_lines.append(
                            f"{var_name}_output = {var_name}.{method_name}({', '.join(method_params)})"
                        )
                else:
                    # Regular parameter handling for non-embedding methods
                    for param in block.parameters[method_name]:
                        if (
                            param != "self"
                            and param in block.parameter_values
                            and block.parameter_values[param] is not None
                        ):
                            value = block.parameter_values[param]

                            # Process parameter value as before
                            if isinstance(value, str):
                                if value.startswith("block:"):
                                    try:
                                        ref_block_idx = int(value.split(":", 1)[1]) - 1
                                        if 0 <= ref_block_idx < len(self.blocks):
                                            ref_var = block_vars[ref_block_idx]
                                            value = f"{ref_var}_output"
                                    except Exception:
                                        if not (
                                            value.startswith(
                                                (
                                                    "'",
                                                    '"',
                                                    "[",
                                                    "{",
                                                    "True",
                                                    "False",
                                                    "None",
                                                )
                                            )
                                            or value.isdigit()
                                        ):
                                            value = f'"{value}"'
                                elif "\\" in value or "/" in value:
                                    value = self._normalize_path(value)
                                    value = f'"{value}"'
                                elif not (
                                    value.startswith(
                                        ("'", '"', "[", "{", "True", "False", "None")
                                    )
                                    or value.isdigit()
                                ):
                                    value = f'"{value}"'

                            param_dict[param] = value
                            method_params.append(f"{param}={value}")

                    # Handle special cases for consumer methods with connections
                    method_code_lines.append(
                        f"\n# Execute {method_name} on {block.class_name}"
                    )

                    if (
                        method_name in consumer_methods
                        and block_idx in reverse_connection_map
                    ):
                        source_block_indices = reverse_connection_map[block_idx]
                        if source_block_indices:
                            source_var = block_vars[source_block_indices[0]]

                            # Handle different method types specially
                            if (
                                method_name == "split_documents"
                                and "documents" in block.parameters[method_name]
                            ):
                                other_params = []
                                for p, v in param_dict.items():
                                    if p != "documents":
                                        other_params.append(f"{p}={v}")

                                param_str = f"documents={source_var}_output"
                                if other_params:
                                    param_str += f", {', '.join(other_params)}"

                                method_code_lines.append(
                                    f"{var_name}_output = {var_name}.{method_name}({param_str})"
                                )
                            elif (
                                method_name == "from_documents"
                                and "documents" in block.parameters[method_name]
                            ):
                                other_params = [
                                    f"{p}={v}"
                                    for p, v in param_dict.items()
                                    if p != "documents"
                                ]
                                param_str = ", ".join(other_params)
                                if param_str:
                                    param_str = f", {param_str}"

                                method_code_lines.append(
                                    f"{var_name}_output = {var_name}.{method_name}(documents={source_var}_output{param_str})"
                                )
                            else:
                                method_code_lines.append(
                                    f"{var_name}_output = {var_name}.{method_name}({', '.join(method_params)})"
                                )
                        else:
                            method_code_lines.append(
                                f"{var_name}_output = {var_name}.{method_name}({', '.join(method_params)})"
                            )

        # Combine all code lines
        code_lines = init_code_lines + method_code_lines

        # Final output
        if execution_order:
            # Find the real endpoint block
            final_block_idx = None
            for idx in execution_order:
                has_outgoing = False
                for block in self.blocks:
                    if block.connected_to == idx:
                        has_outgoing = True
                        break
                if not has_outgoing:
                    final_block_idx = idx
                    break

            if final_block_idx is None:
                final_block_idx = execution_order[-1]

            final_var = block_vars[final_block_idx]
            code_lines.append("\n# Display the final output from the RAG pipeline")
            code_lines.append(
                f'print(f"Final RAG pipeline output: {{type({final_var}_output).__name__}}")'
            )
            code_lines.append(f"print({final_var}_output)")

        # Remove debug print statements, only keep comments and actual code
        clean_code_lines = []
        for line in code_lines:
            if not (line.startswith('print(f"Result from') or 'print(f"Result' in line):
                clean_code_lines.append(line)

        # FINAL SAFETY CHECK: Do one more search for any remaining "data=" in the code
        for i, line in enumerate(clean_code_lines):
            if "embed_documents" in line and "data=" in line:
                clean_code_lines[i] = line.replace("data=", "texts=")
            elif "embed_query" in line and "data=" in line:
                clean_code_lines[i] = line.replace("data=", "text=")

        # Print and save the generated code
        for line in clean_code_lines:
            print(line)
        print("\n=== End of Generated Code ===")

        save = input("\nSave code to a file? (y/n): ").lower()
        if save == "y":
            filename = (
                input("Enter filename (default: rag_pipeline.py): ")
                or "rag_pipeline.py"
            )
            with open(filename, "w") as f:
                for imp in sorted(list(imports)):
                    f.write(f"{imp}\n")

                f.write("\n# RAG Pipeline Setup\n")

                for line in clean_code_lines:
                    f.write(f"{line}\n")

            print(f"✓ Code saved to {filename}")

        input("\nPress Enter to continue...")

    def _ensure_common_methods(self, block_index: int) -> None:
        """
        Ensure that common methods for this component type are selected.
        Also checks for and fixes common class usage issues.

        Args:
            block_index: Index of the block in the pipeline
        """
        block = self.blocks[block_index]
        component_type = block.component_type

        # Fix abstract class issues - replace with concrete implementations
        if component_type == "text_splitters":
            if block.class_name == "TextSplitter":
                # TextSplitter is abstract, warn user and suggest alternative
                print(
                    "⚠ Warning: TextSplitter is an abstract class and cannot be instantiated."
                )
                print("Automatically changing to RecursiveCharacterTextSplitter.")
                block.class_name = "RecursiveCharacterTextSplitter"
                block.module_path = "langchain_text_splitters"
                # Re-discover methods for the new class
                self._discover_methods(block_index)

        # Transfer parameters from split_documents to __init__ for text splitters
        if "split_documents" in block.parameters and "__init__" in block.parameters:
            # Common parameters that should be in __init__ instead of split_documents
            common_params = ["chunk_size", "chunk_overlap", "length_function"]
            for param in common_params:
                # Check if the param exists in split_documents parameters and has a value
                if (
                    param in block.parameter_values
                    and block.parameter_values[param] is not None
                ):
                    # Ensure this parameter is transferred for initialization
                    print(
                        f"Moving parameter {param}={block.parameter_values[param]} to initialization"
                    )

        # Map of component types to their most commonly used methods
        common_methods = {
            "document_loaders": ["load"],
            "text_splitters": ["split_documents"],
            "embeddings": ["embed_documents", "embed_query"],
            "vectorstores": ["similarity_search", "from_documents"],
            "retrievers": ["get_relevant_documents"],
            "llms": ["invoke", "generate"],
            "chat_models": ["invoke", "generate"],
            "chains": ["invoke", "run"],
        }

        # Add common methods if they exist and aren't already selected
        if component_type in common_methods:
            for method_name in common_methods[component_type]:
                if (
                    method_name in block.methods
                    and method_name not in block.selected_methods
                ):
                    block.selected_methods.append(method_name)

    def _normalize_path(self, path: str) -> str:
        """Normalize a file path to use forward slashes."""
        return path.replace("\\", "/")

    def _suggest_parameter_value(
        self, block_index: int, method_name: str, param_name: str
    ) -> Optional[str]:
        """Suggest appropriate parameter values based on component type and parameter name."""
        block = self.blocks[block_index]
        component_type = block.component_type

        # For embeddings, suggest better default parameters
        if component_type == "embeddings":
            if param_name == "model_name" and block.class_name == "OllamaEmbeddings":
                return "llama2"
            if param_name == "base_url":
                return "http://localhost:11434"

        # For document parameters, suggest connecting to previous block output
        if param_name == "documents" and len(self.blocks) > 1:
            # Find blocks that might produce documents
            for i, other_block in enumerate(self.blocks):
                if i != block_index and other_block.component_type in [
                    "document_loaders",
                    "text_splitters",
                ]:
                    return f"block:{i+1}"  # Reference to another block's output

        return None

    def display_pipeline(self) -> None:
        """Display the entire pipeline with connections."""
        self.clear_screen()
        print("╔═════════════════════════════════════════════════════════╗")
        print("║                  RAG Pipeline Simulator                 ║")
        print("╚═════════════════════════════════════════════════════════╝")

        if not self.blocks:
            print("\n⚠ No blocks in the pipeline yet. Use [a] to add a block.")
            return

        print("\nCurrent Pipeline:")
        print("----------------")

        # Determine visualization style (simple text for now)
        for i, block in enumerate(self.blocks):
            marker = "→" if i == self.current_block_index else " "
            connected_to = (
                f" → {self.blocks[block.connected_to].class_name}"
                if block.connected_to is not None
                else ""
            )
            print(
                f"{marker} {i+1}. {block.class_name} ({block.component_type}){connected_to}"
            )

            # Display selected methods if any
            if block.selected_methods:
                print(f"    └─ Methods: {', '.join(block.selected_methods)}")

        print("\nCommands:")
        print("  [a] Add Block     [r] Remove Block      [s] Select Block")
        print("  [c] Connect Blocks [m] Manage Selected   [g] Generate Code")
        print("  [x] Run Pipeline   [q] Quit")


def main():
    """Main function to run the RAG Pipeline Simulator."""
    os.system("cls" if os.name == "nt" else "clear")
    print("╔═════════════════════════════════════════════╗")
    print("║          LangChain RAG Pipeline Simulator   ║")
    print("╚═════════════════════════════════════════════╝")
    print("\nThis simulator allows you to:")
    print("  - Build complete RAG pipelines with LangChain components")
    print("  - Configure parameters for each component")
    print("  - Connect components to form a processing pipeline")
    print("  - Execute the pipeline and see results")
    print("  - Generate executable Python code\n")

    simulator = RAGPipelineSimulator()

    # Main interaction loop
    while True:
        simulator.display_pipeline()
        choice = input("\nEnter command: ").lower()

        if choice == "a":
            simulator.add_block()
        elif choice == "r":
            simulator.remove_block()
        elif choice == "s":
            simulator.select_block()
        elif choice == "c":
            simulator.connect_blocks()
        elif choice == "m":
            simulator.manage_current_block()
        elif choice == "g":
            simulator.generate_code()
        elif choice == "x":
            simulator.run_pipeline()
        elif choice == "q":
            os.system("cls" if os.name == "nt" else "clear")
            print("Thank you for using the LangChain RAG Pipeline Simulator!")
            break
        else:
            print("Invalid command")
            input("\nPress Enter to continue...")


if __name__ == "__main__":
    main()