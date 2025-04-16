# Multi-Method Blocks Testing

This directory contains tests for the multi-method blocks feature, which allows creating custom blocks with multiple methods from a class.

## Overview

The multi-method blocks feature allows users to:
1. Select a library, module, and class
2. Choose multiple methods from that class to include in a single block
3. Configure input/output nodes based on the selected methods
4. Create and use the custom block in their workflow

## Test Files

- `test_api.py`: Tests the server API endpoints used by the multi-method blocks feature
- `test_block_discovery.py`: Tests that block creation and discovery works correctly
- `test_block_representation.py`: Tests that blocks correctly represent selected methods in their structure

All test files use a simple testing approach that verifies the backend functionality without browser dependencies.

## Running the Tests

To run all tests:

```bash
python -m unittest discover tests/multi_method_tests
```

To run a specific test file:

```bash
python -m unittest tests/multi_method_tests/test_api.py
```

## Test Requirements

The tests require the following dependencies:
- requests
- flask
- langchain_community
- langchain_core

These can be installed using:

```bash
pip install -r tests/multi_method_tests/requirements.txt
```

## Testing Philosophy

We focus on simple, effective API-level tests that verify:

1. Library, module, and class discovery works
2. Class details including methods can be retrieved
3. Custom blocks can be created with the right configuration
4. Block connections can be established
5. Created blocks correctly represent selected methods

This approach ensures core functionality works while keeping tests simple to maintain. 