"""
Automated UI tests for block creation and multi-method functionality.

This file contains automated UI tests using Selenium WebDriver to verify
both the current UI functionality and the multi-method block interactions.
These tests replace the manual test scenarios in test_ui_display.py and test_ui_interaction.py.
"""
import unittest
import sys
import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

# Add the parent directory to the path so we can import the server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))


class TestUIAutomation(unittest.TestCase):
    """Automated UI tests for block creation and multi-method functionality."""

    @classmethod
    def setUpClass(cls):
        """Set up the WebDriver once for all tests."""
        # Setup Chrome options
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')  # Run headless for CI environments
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        try:
            cls.driver = webdriver.Chrome(options=options)
            cls.driver.maximize_window()
            cls.wait = WebDriverWait(cls.driver, 10)  # 10 second wait timeout
        except Exception as e:
            print(f"Error setting up WebDriver: {e}")
            raise
            
        # Start the application server (you may need to adjust this)
        # This assumes your server can be started programmatically
        # If not, you'll need to start it separately before running tests
        # cls.server_process = subprocess.Popen(["python", "server.py"])
        # time.sleep(2)  # Give server time to start
        
    @classmethod
    def tearDownClass(cls):
        """Clean up the WebDriver after all tests."""
        if hasattr(cls, 'driver'):
            cls.driver.quit()
            
        # Shutdown the server if started programmatically
        # if hasattr(cls, 'server_process'):
        #     cls.server_process.terminate()
            
    def setUp(self):
        """Set up before each test."""
        # Navigate to the application URL
        self.driver.get("http://localhost:5000")
        time.sleep(1)  # Allow page to load
        
    def test_library_dropdown_display(self):
        """Verify library dropdown displays all available libraries."""
        try:
            # Open custom block creation modal
            create_block_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "create-custom-block-btn"))
            )
            create_block_button.click()
            
            # Wait for the modal to appear
            modal = self.wait.until(
                EC.visibility_of_element_located((By.ID, "custom-block-modal"))
            )
            
            # Find the library dropdown
            library_select = self.driver.find_element(By.ID, "library-select")
            
            # Get all options
            options = library_select.find_elements(By.TAG_NAME, "option")
            option_texts = [opt.text for opt in options if opt.text.strip()]
            
            # Verify expected libraries are present
            self.assertIn("langchain_community", option_texts, "langchain_community not found in dropdown")
            self.assertIn("langchain_core", option_texts, "langchain_core not found in dropdown")
            
            # Verify no duplicates
            self.assertEqual(len(option_texts), len(set(option_texts)), "Duplicate libraries found in dropdown")
            
            print(f"Found {len(option_texts)} libraries in dropdown")
            
        except TimeoutException:
            self.fail("Timed out waiting for element")
            
    def test_module_dropdown_display(self):
        """Verify module dropdown displays modules from selected library."""
        try:
            # Open custom block creation modal
            create_block_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "create-custom-block-btn"))
            )
            create_block_button.click()
            
            # Wait for the modal to appear
            self.wait.until(
                EC.visibility_of_element_located((By.ID, "custom-block-modal"))
            )
            
            # Find and select the library
            library_select = self.driver.find_element(By.ID, "library-select")
            library_select.click()
            
            # Select langchain_community
            community_option = self.driver.find_element(By.XPATH, "//option[text()='langchain_community']")
            community_option.click()
            
            # Wait for modules to load
            time.sleep(1)
            
            # Find the module dropdown
            module_select = self.driver.find_element(By.ID, "module-select")
            
            # Get all options
            options = module_select.find_elements(By.TAG_NAME, "option")
            option_texts = [opt.text for opt in options if opt.text.strip()]
            
            # Verify expected modules are present
            expected_modules = ["document_loaders", "embeddings", "vectorstores"]
            for module in expected_modules:
                self.assertTrue(
                    any(module in opt for opt in option_texts),
                    f"Module {module} not found in dropdown"
                )
            
            # Verify no duplicates
            self.assertEqual(len(option_texts), len(set(option_texts)), "Duplicate modules found in dropdown")
            
            print(f"Found {len(option_texts)} modules in dropdown")
            
        except TimeoutException:
            self.fail("Timed out waiting for element")
    
    def test_class_dropdown_display(self):
        """Verify class dropdown displays classes from selected module."""
        try:
            # Open custom block creation modal
            create_block_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "create-custom-block-btn"))
            )
            create_block_button.click()
            
            # Wait for the modal to appear
            self.wait.until(
                EC.visibility_of_element_located((By.ID, "custom-block-modal"))
            )
            
            # Select library
            library_select = self.driver.find_element(By.ID, "library-select")
            library_select.click()
            community_option = self.driver.find_element(By.XPATH, "//option[text()='langchain_community']")
            community_option.click()
            
            # Wait for modules to load
            time.sleep(1)
            
            # Select module
            module_select = self.driver.find_element(By.ID, "module-select")
            module_select.click()
            
            # Find and select document_loaders
            document_loaders_option = None
            for option in module_select.find_elements(By.TAG_NAME, "option"):
                if "document_loaders" in option.text:
                    document_loaders_option = option
                    break
                    
            self.assertIsNotNone(document_loaders_option, "document_loaders module not found")
            document_loaders_option.click()
            
            # Wait for classes to load
            time.sleep(2)
            
            # Find the class dropdown
            class_select = self.driver.find_element(By.ID, "class-select")
            
            # Get all options
            options = class_select.find_elements(By.TAG_NAME, "option")
            option_texts = [opt.text for opt in options if opt.text.strip()]
            
            # Verify expected classes are present
            expected_classes = ["PyPDFLoader", "TextLoader", "CSVLoader"]
            for cls in expected_classes:
                self.assertTrue(
                    any(cls in opt for opt in option_texts),
                    f"Class {cls} not found in dropdown"
                )
            
            print(f"Found {len(option_texts)} classes in dropdown")
            
        except TimeoutException:
            self.fail("Timed out waiting for element")
    
    def test_method_dropdown_display(self):
        """Verify method dropdown displays methods from selected class."""
        try:
            # Open custom block creation modal
            create_block_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "create-custom-block-btn"))
            )
            create_block_button.click()
            
            # Select library -> module -> class
            self._select_pdfloader_class()
            
            # Find method checkboxes
            method_container = self.driver.find_element(By.ID, "methods-container")
            method_checkboxes = method_container.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
            
            # Get method names from labels
            method_labels = method_container.find_elements(By.CSS_SELECTOR, "label")
            method_names = [label.text for label in method_labels if label.text.strip()]
            
            # Verify expected methods are present
            expected_methods = ["__init__", "load", "load_and_split"]
            for method in expected_methods:
                self.assertTrue(
                    any(method in name for name in method_names),
                    f"Method {method} not found in available methods"
                )
            
            print(f"Found {len(method_names)} methods for PyPDFLoader")
            
        except TimeoutException:
            self.fail("Timed out waiting for element")
    
    def test_multi_method_selection(self):
        """Test selecting multiple methods in the block creation UI."""
        try:
            # Open custom block creation modal
            create_block_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "create-custom-block-btn"))
            )
            create_block_button.click()
            
            # Select library -> module -> class
            self._select_pdfloader_class()
            
            # Find method checkboxes and select multiple
            method_container = self.driver.find_element(By.ID, "methods-container")
            method_checkboxes = method_container.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
            
            # Select at least 3 methods
            selected_methods = []
            for i, checkbox in enumerate(method_checkboxes[:3]):
                # Get the method name
                label = method_container.find_elements(By.CSS_SELECTOR, "label")[i]
                method_name = label.text.strip()
                selected_methods.append(method_name)
                
                # Select the checkbox if not already selected
                if not checkbox.is_selected():
                    checkbox.click()
            
            # Add input/output nodes
            input_field = self.driver.find_element(By.ID, "input-node-input")
            input_field.send_keys("file_path")
            input_field.send_keys(Keys.ENTER)
            
            output_field = self.driver.find_element(By.ID, "output-node-input")
            output_field.send_keys("documents")
            output_field.send_keys(Keys.ENTER)
            
            # Add parameter for __init__
            param_container = self.driver.find_element(By.ID, "parameters-container")
            file_path_input = param_container.find_element(By.CSS_SELECTOR, "input[placeholder='Value']")
            file_path_input.send_keys("test.pdf")
            
            # Create the block
            create_btn = self.driver.find_element(By.ID, "create-block-btn")
            create_btn.click()
            
            # Wait for the block to be created and modal to close
            self.wait.until(
                EC.invisibility_of_element_located((By.ID, "custom-block-modal"))
            )
            
            # Verify block appears in the custom blocks section
            custom_blocks_section = self.driver.find_element(By.CLASS_NAME, "custom-blocks-section")
            new_block = custom_blocks_section.find_element(By.CSS_SELECTOR, ".custom-block-template")
            
            # Drag the block to the canvas
            actions = webdriver.ActionChains(self.driver)
            canvas = self.driver.find_element(By.ID, "canvas-container")
            actions.drag_and_drop(new_block, canvas).perform()
            
            # Wait for block to appear on canvas
            block_on_canvas = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".block.custom-block"))
            )
            
            # Check for method selector dropdown
            method_select = block_on_canvas.find_element(By.CSS_SELECTOR, ".method-select")
            
            # Verify all selected methods are in the dropdown
            options = method_select.find_elements(By.TAG_NAME, "option")
            option_texts = [opt.text for opt in options if opt.text.strip()]
            
            for method in selected_methods:
                self.assertTrue(
                    any(method in opt for opt in option_texts),
                    f"Method {method} not found in block's method selector"
                )
            
            print(f"Successfully created block with methods: {', '.join(selected_methods)}")
            
        except TimeoutException as e:
            self.fail(f"Timed out waiting for element: {e}")
        except Exception as e:
            self.fail(f"Error in test: {e}")
    
    def test_method_parameter_ui(self):
        """Test configuring parameters for multiple methods."""
        try:
            # Open custom block creation modal and create a block with multiple methods
            create_block_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "create-custom-block-btn"))
            )
            create_block_button.click()
            
            # Select library -> module -> class
            self._select_pdfloader_class()
            
            # Select multiple methods
            method_container = self.driver.find_element(By.ID, "methods-container")
            method_checkboxes = method_container.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
            
            # Select __init__ and load_and_split methods
            init_checkbox = None
            split_checkbox = None
            
            for checkbox in method_checkboxes:
                method_id = checkbox.get_attribute("id")
                if "__init__" in method_id:
                    init_checkbox = checkbox
                elif "load_and_split" in method_id:
                    split_checkbox = checkbox
            
            self.assertIsNotNone(init_checkbox, "__init__ method not found")
            self.assertIsNotNone(split_checkbox, "load_and_split method not found")
            
            if not init_checkbox.is_selected():
                init_checkbox.click()
                
            if not split_checkbox.is_selected():
                split_checkbox.click()
            
            # Add input/output nodes
            input_field = self.driver.find_element(By.ID, "input-node-input")
            input_field.send_keys("file_path")
            input_field.send_keys(Keys.ENTER)
            
            output_field = self.driver.find_element(By.ID, "output-node-input")
            output_field.send_keys("documents")
            output_field.send_keys(Keys.ENTER)
            
            # Configure parameters for __init__
            param_containers = self.driver.find_elements(By.CLASS_NAME, "method-parameters")
            for container in param_containers:
                method_name = container.find_element(By.CLASS_NAME, "method-name").text
                if "__init__" in method_name:
                    file_path_input = container.find_element(By.CSS_SELECTOR, "input[placeholder='Value']")
                    file_path_input.send_keys("test.pdf")
                elif "load_and_split" in method_name:
                    # Find text_splitter parameter if it exists
                    try:
                        splitter_input = container.find_element(By.CSS_SELECTOR, "input[placeholder='Value']")
                        splitter_input.send_keys("RecursiveCharacterTextSplitter")
                    except:
                        pass  # Parameter might not exist or have a different name
            
            # Create the block
            create_btn = self.driver.find_element(By.ID, "create-block-btn")
            create_btn.click()
            
            # Wait for the block to be created and modal to close
            self.wait.until(
                EC.invisibility_of_element_located((By.ID, "custom-block-modal"))
            )
            
            print("Successfully created block with parameters for multiple methods")
            
        except TimeoutException:
            self.fail("Timed out waiting for element")
        except Exception as e:
            self.fail(f"Error in test: {e}")
    
    def _select_pdfloader_class(self):
        """Helper method to select PyPDFLoader class in the modal."""
        # Select library
        library_select = self.driver.find_element(By.ID, "library-select")
        library_select.click()
        community_option = self.driver.find_element(By.XPATH, "//option[text()='langchain_community']")
        community_option.click()
        
        # Wait for modules to load
        time.sleep(1)
        
        # Select module
        module_select = self.driver.find_element(By.ID, "module-select")
        module_select.click()
        
        # Find and select document_loaders
        document_loaders_option = None
        for option in module_select.find_elements(By.TAG_NAME, "option"):
            if "document_loaders" in option.text:
                document_loaders_option = option
                break
                
        self.assertIsNotNone(document_loaders_option, "document_loaders module not found")
        document_loaders_option.click()
        
        # Wait for classes to load
        time.sleep(2)
        
        # Select class
        class_select = self.driver.find_element(By.ID, "class-select")
        class_select.click()
        
        # Find and select PyPDFLoader
        pdf_loader_option = None
        for option in class_select.find_elements(By.TAG_NAME, "option"):
            if "PyPDFLoader" in option.text:
                pdf_loader_option = option
                break
                
        self.assertIsNotNone(pdf_loader_option, "PyPDFLoader class not found")
        pdf_loader_option.click()
        
        # Wait for methods to load
        time.sleep(2)


if __name__ == '__main__':
    unittest.main() 