# Multi-Method Block Tests

This directory contains tests for the multi-method block functionality, which allows the creation of blocks that can expose multiple methods from a class.

## Test Files

### Functionality Verification Tests

- **test_block_discovery.py**: Automated unit tests for the backend API endpoints related to block creation, manipulation, and discovery. These tests verify that the core backend functionality works correctly.

### API Tests (Recommended)

- **test_api.py**: API-level tests that directly call the server's endpoints without relying on UI automation. These tests verify the API contracts and behavior in a more reliable way.

API tests are recommended for most scenarios because they:
1. Are faster and more reliable than UI tests
2. Are less brittle to UI changes
3. Focus on the actual functionality rather than UI implementation details
4. Can be run in CI/CD pipelines consistently

### UI Automation Tests (Optional)

- **test_ui_automation.py**: Selenium-based UI tests that automate user interactions. These tests are more complex and can be brittle if the UI changes.

UI tests can be useful for:
1. End-to-end validation of critical user flows
2. Visual regression testing
3. Validating UI-specific behavior that can't be tested via API
4. Simulating real user interactions

However, UI tests are more difficult to maintain and can be flaky due to timing issues, browser differences, and UI changes.

## Requirements

To run the tests, install the required dependencies:

```bash
pip install -r requirements.txt
```

## Running the Tests

### Running API Tests (Recommended)

```bash
python -m unittest test_api.py
```

### Running UI Tests (Optional)

```bash
python -m unittest test_ui_automation.py
```

Note: UI tests require Chrome and ChromeDriver to be installed.

## Test Strategy

Our recommended testing strategy is:

1. Focus on comprehensive API tests for functional verification
2. Use UI tests sparingly for critical user flows
3. Maintain a small set of UI smoke tests to verify basic functionality
4. Prefer API tests for continuous integration and regression testing

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