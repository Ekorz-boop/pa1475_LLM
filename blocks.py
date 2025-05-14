from abc import ABC, abstractmethod
from typing import Dict, List
import os


class Block(ABC):
    def __init__(self):
        self.inputs = {}
        self.outputs = {}
        self.import_string = ""
        self.function_string = ""

    @abstractmethod
    def validate_connections(self) -> bool:
        pass


class Canvas:
    def __init__(self):
        self.blocks: Dict[str, Block] = {}
        self.connections: Dict[str, List[str]] = {}  # source_id -> [target_id]

    def add_block(self, block_id: str, block: Block) -> None:
        """Add a block to the canvas."""
        self.blocks[block_id] = block

    def process_block(self, block_id: str, config: dict) -> dict:
        """Process a block using its implementation."""
        if block_id not in self.blocks:
            return {
                "status": "error",
                "output": f"Block not found: {block_id}",
                "block_id": block_id,
            }

        block = self.blocks[block_id]

        try:
            # For now, return a simple success response
            # In a real implementation, this would execute the block's function
            # with the provided configuration
            block_type = type(block).__name__
            print(f"Processing block {block_id} of type {block_type}")

            # Example implementation - in a real system, this would use the
            # block's function_string or other properties to execute logic
            return {
                "status": "success",
                "output": f"Processed {block_type}",
                "block_id": block_id,
            }
        except Exception as e:
            return {
                "status": "error",
                "output": f"Error processing block: {str(e)}",
                "block_id": block_id,
            }

    def connect_blocks(self, source_id: str, target_id: str) -> bool:
        """Connect two blocks and validate the connection."""
        if source_id not in self.blocks or target_id not in self.blocks:
            return False

        source_block = self.blocks[source_id]
        target_block = self.blocks[target_id]

        # Add connection
        if source_id not in self.connections:
            self.connections[source_id] = []
        self.connections[source_id].append(target_id)

        # Update block inputs/outputs
        target_block.inputs[source_id] = source_block
        source_block.outputs[target_id] = target_block

        return target_block.validate_connections()

    def export_to_python(self, output_file: str) -> None:
        """Export the connected blocks to a Python file."""
        # Create models directory
        try:
            os.makedirs("models", exist_ok=True)
        except Exception:
            pass

        # Collect all imports
        imports = set()
        for block in self.blocks.values():
            if hasattr(block, "import_string"):
                imports.add(block.import_string)

        # Collect all functions
        functions = []
        for block in self.blocks.values():
            if hasattr(block, "function_string"):
                functions.append(block.function_string)

        # Create the main execution flow
        execution_order = self._determine_execution_order()
        main_code = self._generate_main_code(execution_order)

        # Write to file
        with open(output_file, "w", encoding="utf-8") as f:
            # Write imports
            for imp in imports:
                f.write(imp + "\n")
            f.write("\n")

            # Write functions
            for func in functions:
                f.write(func + "\n\n")

            # Write main execution
            f.write("if __name__ == '__main__':\n")
            f.write("    print('Welcome to the RAG Pipeline Application!')\n")
            f.write(
                "    print('This application will help you analyze documents using AI.')\n"
            )
            f.write("    print()\n")
            f.write(main_code)

    def _determine_execution_order(self) -> List[str]:
        """Determine the order in which blocks should be executed using topological sort."""
        # Calculate in-degree for each block
        in_degree = {block_id: 0 for block_id in self.blocks}
        for connections in self.connections.values():
            for target in connections:
                in_degree[target] = in_degree.get(target, 0) + 1

        # Start with blocks that have no incoming edges
        queue = [block_id for block_id, degree in in_degree.items() if degree == 0]
        execution_order = []

        # Process queue
        while queue:
            current = queue.pop(0)
            execution_order.append(current)

            # Reduce in-degree of neighbors
            if current in self.connections:
                for neighbor in self.connections[current]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)

        # Check for cycles
        if len(execution_order) != len(self.blocks):
            raise ValueError("Cycle detected in block connections")

        return execution_order

    def _generate_main_code(self, execution_order: List[str]) -> str:
        """Generate the main execution code based on the block order."""
        code_lines = []
        results = {}  # block_id -> variable_name
        input_map = {}  # target_block_id -> {parameter_name: source_block_id}

        # Build input parameter map for each block
        for source_id, targets in self.connections.items():
            for target_id in targets:
                if target_id not in input_map:
                    input_map[target_id] = {}

                source_block = self.blocks[source_id]
                target_block = self.blocks[target_id]

                # Handle custom blocks
                if hasattr(target_block, "input_nodes") and hasattr(
                    source_block, "output_nodes"
                ):
                    # Map output nodes to input nodes based on connection
                    for i, output_node in enumerate(source_block.output_nodes):
                        if i < len(target_block.input_nodes):
                            input_map[target_id][
                                target_block.input_nodes[i]
                            ] = source_id

        for block_id in execution_order:
            block = self.blocks[block_id]

            # Handle custom blocks
            if hasattr(block, "class_name") and hasattr(block, "methods"):
                # Get the function name based on class name
                func_name = f"create_{block.class_name.lower()}"

                # Get input parameters from connected blocks
                params = []
                if block_id in input_map:
                    for input_node in block.input_nodes:
                        if input_node in input_map[block_id]:
                            source_id = input_map[block_id][input_node]
                            if source_id in results:
                                params.append(results[source_id])

                # Add the function call
                code_lines.append(f"    # Create {block.class_name}")
                code_lines.append(
                    f"    {block_id}_result = {func_name}({', '.join(params)})"
                )
                results[block_id] = f"{block_id}_result"


        # Add final result printing
        if results:
            last_block_id = execution_order[-1]
            code_lines.append("\n    # Print final result")
            code_lines.append(f"    print('\\nFinal result from {last_block_id}:')")
            code_lines.append(f"    print({results[last_block_id]})")

        return "\n".join(code_lines)

    def clear(self):
        """Clear all blocks and connections."""
        self.blocks.clear()
        self.connections.clear()
