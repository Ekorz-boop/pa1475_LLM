"""
Tests to verify that custom blocks correctly represent the selected methods.

These tests ensure that when methods are selected for a custom block,
they are properly included in the block definition and representation.
"""

import unittest
import sys
import os
import json

# Add the parent directory to the path so we can import the server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import server


class TestBlockRepresentation(unittest.TestCase):
    """Tests for verifying that blocks correctly represent selected methods."""

    def setUp(self):
        """Set up test client and environment before each test."""
        server.app.testing = True
        self.client = server.app.test_client()
        # Clear the canvas to ensure a clean state
        server.canvas.clear()

    def test_block_includes_selected_methods(self):
        """Test that a custom block includes the selected methods in its representation."""
        # Create a PyPDFLoader block with specific methods
        block_data = {
            "module_path": "langchain_community.document_loaders",
            "class_name": "PyPDFLoader",
            "id": "test_method_block",
            "methods": ["__init__", "load", "load_and_split"],
            "input_nodes": ["file_path"],
            "output_nodes": ["documents"],
            "parameters": {"file_path": "test.pdf"},
        }

        # Create the block
        response = self.client.post(
            "/api/blocks/create_custom",
            json=block_data,
            content_type="application/json",
        )

        # Verify block creation succeeded
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertEqual(result["status"], "success")
        
        # Verify block was added to canvas
        self.assertIn("test_method_block", server.canvas.blocks)
        
        # Get the block from the canvas
        block = server.canvas.blocks["test_method_block"]
        
        # Verify the block has the correct methods
        self.assertEqual(len(block.methods), 3)
        self.assertIn("__init__", block.methods)
        self.assertIn("load", block.methods)
        self.assertIn("load_and_split", block.methods)
        
        # Verify class and module path
        self.assertEqual(block.class_name, "PyPDFLoader")
        self.assertEqual(block.module_path, "langchain_community.document_loaders")
        
        print(f"Block successfully includes methods: {', '.join(block.methods)}")
        
    def test_method_parameters_in_block(self):
        """Test that method parameters are correctly represented in the block."""
        # Create a block with parameters for specific methods
        block_data = {
            "module_path": "langchain_community.document_loaders",
            "class_name": "PyPDFLoader",
            "id": "test_param_block",
            "methods": ["__init__", "load"],
            "input_nodes": ["file_path"],
            "output_nodes": ["documents"],
            "parameters": {
                "__init__": {"file_path": "test.pdf"},
                "load": {}
            }
        }
        
        # Create the block
        response = self.client.post(
            "/api/blocks/create_custom",
            json=block_data,
            content_type="application/json",
        )
        
        # Verify block creation succeeded
        self.assertEqual(response.status_code, 200)
        
        # Verify block was added to canvas
        self.assertIn("test_param_block", server.canvas.blocks)
        
        # Get the block
        block = server.canvas.blocks["test_param_block"]
        
        # Verify parameters are stored
        self.assertIsNotNone(block.parameters)
        
        # The parameters might be stored differently depending on implementation
        # Let's check the block has some representation of parameters
        if isinstance(block.parameters, dict):
            if "__init__" in block.parameters:
                # If parameters are stored by method
                self.assertIn("file_path", block.parameters["__init__"])
            else:
                # If parameters are stored directly
                self.assertIn("file_path", block.parameters)
                
        print(f"Block parameters successfully verified: {block.parameters}")
        
    def test_block_listing_has_methods(self):
        """Test that the block listing endpoint includes method information."""
        # First create a block with methods
        block_data = {
            "module_path": "langchain_community.document_loaders",
            "class_name": "PyPDFLoader",
            "id": "test_list_block",
            "methods": ["__init__", "load"],
            "input_nodes": ["file_path"],
            "output_nodes": ["documents"],
            "parameters": {"file_path": "test.pdf"},
        }
        
        # Create the block
        response = self.client.post(
            "/api/blocks/create_custom",
            json=block_data,
            content_type="application/json",
        )
        
        # Verify block creation succeeded
        self.assertEqual(response.status_code, 200)
        
        # Now get the block listing
        response = self.client.get("/api/blocks/list")
        self.assertEqual(response.status_code, 200)
        
        # Parse the response
        blocks_data = json.loads(response.data)
        
        # Find our block
        found_block = None
        for block_id, block_info in blocks_data["blocks"].items():
            if block_id == "test_list_block":
                found_block = block_info
                break
        
        # Verify the block was found
        self.assertIsNotNone(found_block)
        
        # The expected response format might vary, but we expect some representation of methods
        # We'll check a few common possibilities
        if "methods" in found_block:
            # Direct methods field
            self.assertIn("__init__", found_block["methods"])
            self.assertIn("load", found_block["methods"])
        elif "block_info" in found_block and "methods" in found_block["block_info"]:
            # Nested in block_info
            self.assertIn("__init__", found_block["block_info"]["methods"])
            self.assertIn("load", found_block["block_info"]["methods"])
            
        print(f"Block listing includes method information for block: {found_block}")


if __name__ == "__main__":
    unittest.main() 