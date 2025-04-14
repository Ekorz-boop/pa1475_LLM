# Multi-Method Block Tests

This directory contains test cases to verify the multi-method handling functionality for blocks.

## Purpose

The primary goal of these tests is to ensure that blocks can execute multiple methods in sequence, rather than just a single method. This enables more complex workflows within a single block.

## Test Files

### Existing Functionality Verification

Before implementing new features, we verify that existing functionality works correctly:

1. **test_block_discovery.py**
   - Verifies that libraries, modules, classes, and methods are correctly discovered
   - Tests the creation of custom blocks with the current implementation
   - Ensures block connections work properly

2. **test_ui_display.py** (Manual test guidelines)
   - Contains manual test scenarios for verifying UI display of block information
   - Tests the dropdowns, parameter inputs, and block visualization

3. **test_ui_interaction.py** (Manual test guidelines)
   - Contains manual test scenarios for UI interactions with multi-method blocks
   - Documents expected behavior for multi-method selection and configuration

4. **test_ui_automation.py** (Automated UI tests)
   - Automated Selenium tests replacing the manual tests in test_ui_display.py and test_ui_interaction.py
   - Verifies UI components and interactions programmatically
   - Requires Selenium WebDriver and Chrome/Firefox to be installed

### Multi-Method Implementation Tests

These tests verify the new multi-method functionality:

1. **test_multi_method_blocks.py**
   - Tests that blocks can be configured with multiple methods
   - Verifies method execution sequence
   - Tests data flow between methods within a block

2. **test_api_integration.py**
   - Tests the API endpoints related to multi-method blocks
   - Verifies creation, editing, and execution of multi-method blocks

3. **test_examples.py**
   - Contains example test cases that demonstrate practical uses for multi-method blocks
   - Provides test data for validating the implementation

## Running Tests

To run the automated tests:

```bash
python -m unittest tests/multi_method_tests/test_block_discovery.py
python -m unittest tests/multi_method_tests/test_multi_method_blocks.py
python -m unittest tests/multi_method_tests/test_api_integration.py
python -m unittest tests/multi_method_tests/test_examples.py
```

To run all tests at once:

```bash
python -m unittest discover -s tests/multi_method_tests
```

## Test Status

| Test Case | Status |
|-----------|--------|
| Block Discovery | ⬜ Not Started |
| UI Display | ⬜ Not Started |
| Basic Multi-Method Configuration | ⬜ Not Started |
| Method Execution Sequence | ⬜ Not Started |
| Data Flow Between Methods | ⬜ Not Started | 