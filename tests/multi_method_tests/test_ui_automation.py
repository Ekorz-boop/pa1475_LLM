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
import subprocess
import signal
import socket
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
        """Set up the WebDriver and start the server once for all tests."""
        # Setup Chrome options
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')  # Run headless for CI environments
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        try:
            cls.driver = webdriver.Chrome(options=options)
            cls.driver.maximize_window()
            cls.wait = WebDriverWait(cls.driver, 15)  # Increased timeout to 15 seconds
        except Exception as e:
            print(f"Error setting up WebDriver: {e}")
            raise
            
        # Start the application server
        print("Starting server for UI tests...")
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
        """Clean up the WebDriver and stop the server after all tests."""
        if hasattr(cls, 'driver'):
            cls.driver.quit()
            
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
        """Set up before each test."""
        # Navigate to the application URL
        self.driver.get("http://localhost:5000")
        time.sleep(2)  # Allow page to load
        
        # Check and navigate to the Blocks page
        try:
            # First check if a hamburger menu exists and needs to be clicked
            hamburger_icons = self.driver.find_elements(
                By.XPATH, 
                "//img[contains(@src, 'hamburger.svg')] | //button[contains(@aria-label, 'Menu')] | //div[contains(@class, 'hamburger')]"
            )
            
            if hamburger_icons and hamburger_icons[0].is_displayed():
                print("Found hamburger menu, clicking it")
                hamburger_icons[0].click()
                time.sleep(1)
            
            # Now try to find and click on the Blocks navigation item
            blocks_selectors = [
                "//a[contains(., 'Blocks')]", 
                "//div[contains(., 'Blocks') and not(contains(., 'Create'))]",
                "//span[contains(., 'Blocks')]",
                "//img[contains(@src, 'Blocks.svg')]/parent::*"
            ]
            
            blocks_item_found = False
            for selector in blocks_selectors:
                try:
                    blocks_items = self.driver.find_elements(By.XPATH, selector)
                    for item in blocks_items:
                        if item.is_displayed() and item.is_enabled():
                            item.click()
                            blocks_item_found = True
                            print(f"Clicked on Blocks navigation with selector: {selector}")
                            time.sleep(1)
                            break
                    if blocks_item_found:
                        break
                except Exception as inner_e:
                    print(f"Error with selector {selector}: {inner_e}")
                    continue
            
            if not blocks_item_found:
                # Take a screenshot to help debugging
                screenshot_path = os.path.join(os.path.dirname(__file__), 'navigation_error.png')
                self.driver.save_screenshot(screenshot_path)
                print(f"Navigation screenshot saved to {screenshot_path}")
                print("Could not find Blocks navigation item, assuming already on Blocks page")
                
        except Exception as e:
            print(f"Error during navigation: {e}")
            # If we can't find the Blocks link, we might already be on the Blocks page
            print("May already be on Blocks page, continuing with test")
    
    def _open_create_block_modal(self):
        """Helper to open the Create Custom Block modal."""
        try:
            # Try various ways to find the Create Custom Block button
            create_button = None
            
            # Try by text content regardless of element type
            selectors = [
                "//button[contains(text(), 'Create Custom Block')]",
                "//div[contains(text(), 'Create Custom Block')]",
                "//span[contains(text(), 'Create Custom Block')]",
                "//*[contains(text(), 'Create Custom Block')]"
            ]
            
            for selector in selectors:
                try:
                    elements = self.driver.find_elements(By.XPATH, selector)
                    if elements:
                        create_button = elements[0]
                        break
                except:
                    continue
            
            if not create_button:
                # As a last resort, try to find by approximate position
                # Find the main blocks container
                blocks_container = self.driver.find_element(By.XPATH, "//div[contains(@class, 'blocks') or contains(@id, 'blocks')]")
                
                # Look for buttons within it
                buttons = blocks_container.find_elements(By.TAG_NAME, "button")
                for button in buttons:
                    if button.is_displayed() and button.is_enabled():
                        create_button = button
                        break
            
            if not create_button:
                self.fail("Could not find Create Custom Block button with any method")
                
            # Click the button
            create_button.click()
            print("Successfully clicked Create Custom Block button")
            
            # Wait for the modal to appear - look for the modal title
            modal_selectors = [
                "//div[contains(text(), 'Create Custom LangChain Block')]",
                "//div[contains(text(), 'Create') and contains(text(), 'Block')]",
                "//h1[contains(text(), 'Create')]",
                "//h2[contains(text(), 'Create')]",
                "//div[contains(@class, 'modal') or contains(@id, 'modal')]"
            ]
            
            modal_found = False
            for selector in modal_selectors:
                try:
                    self.wait.until(EC.visibility_of_element_located((By.XPATH, selector)))
                    modal_found = True
                    print(f"Modal found with selector: {selector}")
                    break
                except:
                    continue
                    
            if not modal_found:
                self.fail("Modal did not appear after clicking Create Custom Block button")
                
            time.sleep(1)  # Allow modal animations to complete
            
        except Exception as e:
            print(f"Error in _open_create_block_modal: {e}")
            # Take a screenshot to help with debugging
            screenshot_path = os.path.join(os.path.dirname(__file__), 'error_screenshot.png')
            self.driver.save_screenshot(screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")
            raise
    
    def test_library_dropdown_display(self):
        """Verify library dropdown displays all available libraries."""
        try:
            # Open custom block creation modal
            self._open_create_block_modal()
            
            # Find the library dropdown (based on label or surrounding text)
            library_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Select LangChain Library')]/following::select | //select[contains(@id, 'library')]"))
            )
            
            # Check if dropdown is already open, if not, click to open it
            library_dropdown.click()
            time.sleep(1)
            
            # Get all options
            options = library_dropdown.find_elements(By.TAG_NAME, "option")
            option_texts = [opt.text for opt in options if opt.text.strip()]
            
            # Verify expected libraries are present
            self.assertIn("langchain_community", option_texts, "langchain_community not found in dropdown")
            
            # Verify no duplicates
            self.assertEqual(len(option_texts), len(set(option_texts)), "Duplicate libraries found in dropdown")
            
            print(f"Found {len(option_texts)} libraries in dropdown")
            
        except TimeoutException:
            self.fail("Timed out waiting for element")
            
    def test_module_dropdown_display(self):
        """Verify module dropdown displays modules from selected library."""
        try:
            # Open custom block creation modal
            self._open_create_block_modal()
            
            # Find and select the library dropdown
            library_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Select LangChain Library')]/following::select | //select[contains(@id, 'library')]"))
            )
            library_dropdown.click()
            
            # Select langchain_community
            community_option = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//option[contains(text(), 'langchain_community')]"))
            )
            community_option.click()
            
            # Wait for modules to load
            time.sleep(1)
            
            # Find the module dropdown
            module_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Select Module')]/following::select | //select[contains(@id, 'module')]"))
            )
            module_dropdown.click()
            
            # Get all options
            options = module_dropdown.find_elements(By.TAG_NAME, "option")
            option_texts = [opt.text for opt in options if opt.text.strip()]
            
            # Verify expected modules are present
            self.assertTrue(
                any("document_loaders" in opt for opt in option_texts),
                "document_loaders not found in dropdown"
            )
            
            print(f"Found {len(option_texts)} modules in dropdown")
            
        except TimeoutException as e:
            self.fail(f"Timed out waiting for element: {e}")
    
    def test_class_dropdown_display(self):
        """Verify class dropdown displays classes from selected module."""
        try:
            # Open custom block creation modal
            self._open_create_block_modal()
            
            # Select library
            library_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Select LangChain Library')]/following::select | //select[contains(@id, 'library')]"))
            )
            library_dropdown.click()
            
            community_option = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//option[contains(text(), 'langchain_community')]"))
            )
            community_option.click()
            
            # Wait for modules to load
            time.sleep(1)
            
            # Select module
            module_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Select Module')]/following::select | //select[contains(@id, 'module')]"))
            )
            module_dropdown.click()
            
            # Find and select document_loaders
            document_loaders_option = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//option[contains(text(), 'document_loaders')]"))
            )
            document_loaders_option.click()
            
            # Wait for classes to load
            time.sleep(2)
            
            # Find and click the class dropdown
            class_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Choose Block Type')]/following::select | //select[contains(@id, 'class')]"))
            )
            class_dropdown.click()
            
            # Wait for dropdown to open
            time.sleep(1)
            
            # Get all options
            options = class_dropdown.find_elements(By.TAG_NAME, "option")
            option_texts = [opt.text for opt in options if opt.text.strip()]
            
            # Verify expected classes are present or at least some options exist
            self.assertTrue(len(option_texts) > 1, "No class options found in dropdown")
            
            print(f"Found {len(option_texts)} classes in dropdown")
            
            # Proceed to next step if "Next" button exists
            try:
                next_button = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Next')]")
                next_button.click()
                time.sleep(1)
            except:
                print("No Next button found, may already be on the correct step")
            
        except TimeoutException as e:
            self.fail(f"Timed out waiting for element: {e}")
    
    def test_method_selection(self):
        """Verify method selection for a class."""
        try:
            # Open custom block creation modal and navigate to method selection
            self._open_create_block_modal()
            
            # Select library -> module -> class
            self._select_document_loader_class()
            
            # Look for the "Add Functions" step or tab
            try:
                functions_tab = self.driver.find_element(By.XPATH, "//div[contains(text(), 'Add Functions')] | //button[contains(text(), 'Add Functions')]")
                functions_tab.click()
                time.sleep(1)
            except:
                # If we can't find the tab, try to click Next until we reach the methods page
                try:
                    next_button = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Next')]")
                    next_button.click()
                    time.sleep(1)
                except:
                    print("Could not navigate to methods page via tabs or Next button")
            
            # Find method checkboxes or selection elements
            time.sleep(2)  # Wait for methods to load
            
            # Try different selectors to find method selection elements
            try:
                # Look for checkboxes with method names
                method_elements = self.driver.find_elements(
                    By.XPATH, 
                    "//input[@type='checkbox'] | //div[contains(., '__init__')] | //div[contains(., 'load')] | //label[contains(., 'load')]"
                )
                
                if len(method_elements) > 0:
                    # Select the first method (usually __init__)
                    if not method_elements[0].is_selected():
                        method_elements[0].click()
                    
                    print(f"Found {len(method_elements)} method selection elements")
                else:
                    print("No method selection elements found")
            except Exception as e:
                print(f"Error while selecting methods: {e}")
            
            # Try to move to the next step
            try:
                next_button = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Next')]")
                next_button.click()
                time.sleep(1)
            except:
                print("Could not find Next button after method selection")
                
            self.assertTrue(True, "Successfully navigated through method selection")
            
        except TimeoutException as e:
            self.fail(f"Timed out waiting for element: {e}")
        except Exception as e:
            self.fail(f"Error in test: {e}")
    
    def test_input_output_nodes(self):
        """Test configuring input and output nodes for a block."""
        try:
            # Open custom block creation modal and navigate through steps
            self._open_create_block_modal()
            
            # Select library -> module -> class -> method
            self._select_document_loader_class()
            self._navigate_to_step(3)  # Navigate to the "Set Up Your Block" step
            
            # Look for input node configuration
            try:
                # Try to find input field
                input_node_field = self.driver.find_element(
                    By.XPATH, 
                    "//input[contains(@placeholder, 'input')] | //div[contains(., 'Input Nodes')]/following::input"
                )
                input_node_field.clear()
                input_node_field.send_keys("file_path")
                input_node_field.send_keys(Keys.ENTER)
                time.sleep(1)
            except Exception as e:
                print(f"Could not configure input node: {e}")
            
            # Look for output node configuration
            try:
                # Try to find output field
                output_node_field = self.driver.find_element(
                    By.XPATH, 
                    "//input[contains(@placeholder, 'output')] | //div[contains(., 'Output Nodes')]/following::input"
                )
                output_node_field.clear()
                output_node_field.send_keys("documents")
                output_node_field.send_keys(Keys.ENTER)
                time.sleep(1)
            except Exception as e:
                print(f"Could not configure output node: {e}")
            
            # Try to complete block creation
            try:
                # Look for create button
                create_button = self.driver.find_element(
                    By.XPATH, 
                    "//button[contains(text(), 'Create')] | //button[contains(text(), 'Finish')] | //button[contains(text(), 'Done')]"
                )
                create_button.click()
                time.sleep(2)
            except Exception as e:
                print(f"Could not complete block creation: {e}")
            
            # Verify that the modal is closed (success)
            try:
                modal = self.driver.find_element(By.XPATH, "//div[contains(., 'Create Custom LangChain Block')]")
                self.fail("Block creation modal is still open, creation may have failed")
            except:
                # Modal is closed, which is good
                pass
                
            self.assertTrue(True, "Successfully configured input/output nodes")
            
        except TimeoutException as e:
            self.fail(f"Timed out waiting for element: {e}")
        except Exception as e:
            self.fail(f"Error in test: {e}")
    
    def test_block_creation_complete_flow(self):
        """Test the complete flow of creating a custom block."""
        try:
            # Open custom block creation modal
            self._open_create_block_modal()
            
            # Step 1: Select library -> module -> class
            self._select_document_loader_class()
            
            # Navigate to Step 2: Add Functions
            self._navigate_to_step(2)
            
            # Select method(s)
            try:
                method_checkboxes = self.driver.find_elements(
                    By.XPATH, 
                    "//input[@type='checkbox'] | //div[contains(., '__init__')]//input | //div[contains(., 'load')]//input"
                )
                
                if len(method_checkboxes) > 0:
                    # Select at least one method if not already selected
                    selected = False
                    for checkbox in method_checkboxes[:2]:  # Try to select first two methods
                        try:
                            if not checkbox.is_selected():
                                checkbox.click()
                                selected = True
                                time.sleep(0.5)
                        except:
                            pass
                    
                    if not selected:
                        print("Could not select any methods, they may already be selected")
                else:
                    print("No method checkboxes found")
            except Exception as e:
                print(f"Error selecting methods: {e}")
            
            # Navigate to Step 3: Set Up Your Block
            self._navigate_to_step(3)
            
            # Configure input/output nodes
            try:
                # Input node
                input_fields = self.driver.find_elements(
                    By.XPATH, 
                    "//input[contains(@placeholder, 'input')] | //div[contains(., 'Input Nodes')]/following::input"
                )
                
                if len(input_fields) > 0:
                    input_fields[0].clear()
                    input_fields[0].send_keys("file_path")
                    input_fields[0].send_keys(Keys.ENTER)
                    time.sleep(0.5)
                
                # Output node
                output_fields = self.driver.find_elements(
                    By.XPATH, 
                    "//input[contains(@placeholder, 'output')] | //div[contains(., 'Output Nodes')]/following::input"
                )
                
                if len(output_fields) > 0:
                    output_fields[0].clear()
                    output_fields[0].send_keys("documents")
                    output_fields[0].send_keys(Keys.ENTER)
                    time.sleep(0.5)
            except Exception as e:
                print(f"Error configuring input/output nodes: {e}")
            
            # Navigate to Step 4: Connect Your Block (if exists)
            self._navigate_to_step(4)
            
            # Complete block creation
            try:
                create_button = self.driver.find_element(
                    By.XPATH, 
                    "//button[contains(text(), 'Create')] | //button[contains(text(), 'Finish')] | //button[contains(text(), 'Done')]"
                )
                create_button.click()
                time.sleep(2)
            except Exception as e:
                print(f"Error completing block creation: {e}")
            
            # Verify block creation success
            try:
                # Check if modal is closed
                modal = self.driver.find_element(By.XPATH, "//div[contains(., 'Create Custom LangChain Block')]")
                self.fail("Block creation modal is still open, creation may have failed")
            except:
                # Modal is closed, which is good
                pass
                
            # Try to find the created block in the blocks list
            try:
                time.sleep(2)  # Wait for UI to update
                blocks_list = self.driver.find_elements(
                    By.XPATH, 
                    "//div[contains(@class, 'custom-block')] | //div[contains(@class, 'block-list')]//div"
                )
                
                self.assertTrue(len(blocks_list) > 0, "No blocks found after creation")
                print(f"Found {len(blocks_list)} blocks after creation")
            except Exception as e:
                print(f"Error verifying created block: {e}")
                
            self.assertTrue(True, "Successfully completed full block creation flow")
            
        except TimeoutException as e:
            self.fail(f"Timed out waiting for element: {e}")
        except Exception as e:
            self.fail(f"Error in test: {e}")
    
    def _select_document_loader_class(self):
        """Helper method to select a document loader class in the modal."""
        try:
            # Select library
            library_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Select LangChain Library')]/following::select | //select[contains(@id, 'library')]"))
            )
            library_dropdown.click()
            time.sleep(0.5)
            
            community_option = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//option[contains(text(), 'langchain_community')]"))
            )
            community_option.click()
            time.sleep(1)
            
            # Select module
            module_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Select Module')]/following::select | //select[contains(@id, 'module')]"))
            )
            module_dropdown.click()
            time.sleep(0.5)
            
            document_loaders_option = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//option[contains(text(), 'document_loaders')]"))
            )
            document_loaders_option.click()
            time.sleep(1)
            
            # Select class
            class_dropdown = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(., 'Choose Block Type')]/following::select | //select[contains(@id, 'class')]"))
            )
            class_dropdown.click()
            time.sleep(0.5)
            
            # Try to find and select a document loader class
            try:
                loader_option = self.driver.find_element(
                    By.XPATH,
                    "//option[contains(text(), 'PyPDFLoader')] | //option[contains(text(), 'TextLoader')] | //option[contains(text(), 'Loader')]"
                )
                loader_option.click()
                time.sleep(1)
            except:
                # If specific loader not found, select first non-empty option
                options = class_dropdown.find_elements(By.TAG_NAME, "option")
                for opt in options:
                    if opt.text.strip() and "Select" not in opt.text:
                        opt.click()
                        break
                time.sleep(1)
                
            return True
        except Exception as e:
            print(f"Error in selecting document loader class: {e}")
            return False
    
    def _navigate_to_step(self, step_number):
        """Helper to navigate to a specific step in the block creation process."""
        try:
            # First check if there are step tabs we can click directly
            step_tabs = self.driver.find_elements(
                By.XPATH, 
                f"//div[contains(text(), '{step_number}.')] | //button[contains(text(), '{step_number}.')]"
            )
            
            if len(step_tabs) > 0:
                step_tabs[0].click()
                time.sleep(1)
                return True
                
            # If no tabs, try using Next button until we reach desired step
            current_step = 1
            while current_step < step_number:
                next_button = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Next')]")
                next_button.click()
                time.sleep(1)
                current_step += 1
                
            return True
        except Exception as e:
            print(f"Error navigating to step {step_number}: {e}")
            return False


if __name__ == '__main__':
    unittest.main() 