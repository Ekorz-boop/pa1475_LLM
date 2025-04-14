"""
API-level tests for multi-method block functionality.

This file contains tests that directly call the server's API endpoints
instead of relying on UI interactions.
"""
import unittest
import sys
import os
import json
import time
import subprocess
import signal
import socket
import requests

# Add the parent directory to the path so we can import the server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))


class TestMultiMethodBlocksAPI(unittest.TestCase):
    """Test multi-method block functionality via API calls."""

    @classmethod
    def setUpClass(cls):
        """Start the server once for all tests."""
        # Start the application server
        print("Starting server for API tests...")
        server_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../server.py'))
        
        # On Windows
        if os.name == 'nt':
            cls.server_process = subprocess.Popen(['python', server_path], 
                                                 creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        # On Unix-like systems
        else:
            cls.server_process = subprocess.Popen(['python', server_path], 
                                                 preexec_fn=os.setsid)
            
        # Wait for server to start - poll the port
        print("Waiting for server to start...")
        max_attempts = 30
        attempts = 0
        while attempts < max_attempts:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.connect(('localhost', 5000))
                    print("Server is running!")
                    break
            except:
                attempts += 1
                time.sleep(1)
                if attempts % 5 == 0:
                    print(f"Still waiting for server... ({attempts}/{max_attempts})")
        
        if attempts == max_attempts:
            print("Failed to connect to server after maximum attempts.")
            # Try to terminate the server process if it started
            cls.tearDownClass()
            raise Exception("Server failed to start")
         
    @classmethod
    def tearDownClass(cls):
        """Stop the server after all tests."""
        # Terminate the server process
        if hasattr(cls, 'server_process'):
            print("Shutting down server...")
            # On Windows
            if os.name == 'nt':
                cls.server_process.send_signal(signal.CTRL_BREAK_EVENT)
            # On Unix-like systems
            else:
                os.killpg(os.getpgid(cls.server_process.pid), signal.SIGTERM)
                
            # Wait for the process to terminate
            try:
                cls.server_process.wait(timeout=5)
                print("Server shutdown complete!")
            except subprocess.TimeoutExpired:
                print("Server didn't terminate gracefully, forcing termination...")
                cls.server_process.kill()
    
    def setUp(self):
        """Initialize the API base URL."""
        self.base_url = "http://localhost:5000/api"
    
    def test_libraries_api(self):
        """Test the API endpoint that lists available libraries."""
        response = requests.get(f"{self.base_url}/langchain/libraries")
        self.assertEqual(response.status_code, 200)
        
        libraries = response.json()
        self.assertIsInstance(libraries, list)
        self.assertIn("langchain_community", libraries)
        
        print(f"Found {len(libraries)} libraries")
    
    def test_modules_api(self):
        """Test the API endpoint that lists modules within a library."""
        response = requests.get(f"{self.base_url}/langchain/modules", params={"library": "langchain_community"})
        self.assertEqual(response.status_code, 200)
        
        modules = response.json()
        self.assertIsInstance(modules, list)
        
        # Check that some expected modules exist
        module_names = [module for module in modules]
        self.assertTrue(any("document_loaders" in module for module in module_names))
        
        print(f"Found {len(modules)} modules in langchain_community")
    
    def test_classes_api(self):
        """Test the API endpoint that lists classes within a module."""
        response = requests.get(
            f"{self.base_url}/langchain/classes", 
            params={"module": "langchain_community.document_loaders"}
        )
        self.assertEqual(response.status_code, 200)
        
        classes = response.json()
        self.assertIsInstance(classes, list)
        
        # Check that some expected classes exist
        class_names = [cls for cls in classes]
        self.assertTrue(any("PyPDFLoader" in cls for cls in class_names) or 
                        any("TextLoader" in cls for cls in class_names) or
                        any("CSVLoader" in cls for cls in class_names))
        
        print(f"Found {len(classes)} classes in langchain_community.document_loaders")
    
    def test_methods_api(self):
        """Test the API endpoint that lists methods for a class."""
        response = requests.get(
            f"{self.base_url}/langchain/methods", 
            params={
                "library": "langchain_community",
                "module": "document_loaders",
                "class_name": "PyPDFLoader"
            }
        )
        self.assertEqual(response.status_code, 200)
        
        methods = response.json()
        self.assertIsInstance(methods, list)
        
        # Check that some expected methods exist
        method_names = [method for method in methods]
        self.assertTrue(any("__init__" in method for method in method_names) or
                       any("load" in method for method in method_names))
        
        print(f"Found {len(methods)} methods for PyPDFLoader")
    
    def test_create_block_api(self):
        """Test the API for creating a custom block."""
        # Create a block definition
        block_data = {
            "library": "langchain_community",
            "module": "document_loaders",
            "class_name": "PyPDFLoader",
            "methods": ["__init__", "load"],
            "input_nodes": ["file_path"],
            "output_nodes": ["documents"],
            "parameters": {
                "__init__": {
                    "file_path": "test.pdf"
                }
            }
        }
        
        # Call the create block API
        response = requests.post(
            f"{self.base_url}/blocks/create",
            json=block_data
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify the response contains a block ID
        result = response.json()
        self.assertIn("block_id", result)
        block_id = result["block_id"]
        
        print(f"Successfully created block with ID: {block_id}")
        
        return block_id
    
    def test_get_block_api(self):
        """Test the API for retrieving a block by ID."""
        # First create a block
        block_id = self.test_create_block_api()
        
        # Get the block details
        response = requests.get(
            f"{self.base_url}/blocks/{block_id}"
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify the block data
        block = response.json()
        self.assertEqual(block["class_name"], "PyPDFLoader")
        self.assertIn("__init__", block["methods"])
        self.assertIn("load", block["methods"])
        
        print(f"Successfully retrieved block with ID: {block_id}")
    
    def test_update_block_api(self):
        """Test the API for updating a block."""
        # First create a block
        block_id = self.test_create_block_api()
        
        # Update the block data
        update_data = {
            "methods": ["__init__", "load", "load_and_split"],
            "output_nodes": ["documents", "chunks"],
            "parameters": {
                "__init__": {
                    "file_path": "updated.pdf"
                }
            }
        }
        
        response = requests.put(
            f"{self.base_url}/blocks/{block_id}",
            json=update_data
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify the block was updated
        response = requests.get(
            f"{self.base_url}/blocks/{block_id}"
        )
        
        updated_block = response.json()
        self.assertIn("load_and_split", updated_block["methods"])
        self.assertIn("chunks", updated_block["output_nodes"])
        
        print(f"Successfully updated block with ID: {block_id}")
    
    def test_delete_block_api(self):
        """Test the API for deleting a block."""
        # First create a block
        block_id = self.test_create_block_api()
        
        # Delete the block
        response = requests.delete(
            f"{self.base_url}/blocks/{block_id}"
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify the block was deleted
        response = requests.get(
            f"{self.base_url}/blocks/{block_id}"
        )
        
        self.assertEqual(response.status_code, 404)
        
        print(f"Successfully deleted block with ID: {block_id}")
    
    def test_block_connections_api(self):
        """Test the API for creating connections between blocks."""
        # Create two blocks
        block1_id = self.test_create_block_api()
        
        block2_data = {
            "library": "langchain_community",
            "module": "text_splitter",
            "class_name": "RecursiveCharacterTextSplitter",
            "methods": ["__init__", "split_documents"],
            "input_nodes": ["documents"],
            "output_nodes": ["chunks"],
            "parameters": {
                "__init__": {
                    "chunk_size": 1000,
                    "chunk_overlap": 200
                }
            }
        }
        
        response = requests.post(
            f"{self.base_url}/blocks/create",
            json=block2_data
        )
        
        self.assertEqual(response.status_code, 200)
        block2_id = response.json()["block_id"]
        
        # Create a connection between the blocks
        connection_data = {
            "source_block_id": block1_id,
            "target_block_id": block2_id,
            "source_node": "documents",
            "target_node": "documents"
        }
        
        response = requests.post(
            f"{self.base_url}/connections/create",
            json=connection_data
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify the connection
        response = requests.get(
            f"{self.base_url}/connections",
            params={"block_id": block1_id}
        )
        
        self.assertEqual(response.status_code, 200)
        connections = response.json()
        
        # Verify connections data structure (may vary depending on your API)
        self.assertTrue(any(
            conn.get("source_block_id") == block1_id and 
            conn.get("target_block_id") == block2_id
            for conn in connections
        ))
        
        print(f"Successfully created and verified connection between blocks {block1_id} and {block2_id}")


if __name__ == '__main__':
    unittest.main() 