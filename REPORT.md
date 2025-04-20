# Method-Specific Input/Output Nodes Feature Extension Report

## 1. Overview

This report outlines the implementation plan for enhancing the block creation system in our LLM RAG Pipeline Builder to support method-specific input/output nodes and enhanced parameter configurations. Currently, blocks have global input and output nodes, but the enhancement will allow defining input and output nodes for individual methods within each block, as well as more specialized parameter input methods.

## 2. Current System Analysis

### 2.1 Block Creation Process

The current block creation workflow consists of 4 steps in the UI:
1. Choose Block Type - Select LangChain library, module, and class
2. Add Methods - Select which methods to include in the block
3. Set Up Parameters - Configure parameters for methods
4. Add Input/Output Nodes - Add global input/output nodes for the block

### 2.2 Core Components

1. **Frontend Components**:
   - `custom-block-handler.js` - Manages the UI for block creation and configuration
   - `app.js` - Handles block rendering, connection management, and block execution

2. **Backend Components**:
   - `server.py` - Provides API endpoints for block creation, management, and execution
   - `blocks.py` - Defines the base Block classes and their implementations

### 2.3 Current Data Model

Currently, blocks store:
- `inputs` and `outputs` - For global block inputs/outputs
- `import_string` - Import statements for the block
- `function_string` - Function implementation
- `methods` - List of methods the block supports
- `parameters` - Method parameters

### 2.4 Limitations

1. Inputs and outputs are defined at the block level, not per method
2. Method selection is available but not tied to specific inputs or outputs
3. No way to specify which inputs/outputs are used by which methods
4. Limited parameter input types (only basic text/number inputs)
5. No specialized UI for selecting files, folders, or other complex data types
6. Cannot visualize PDF content or other file-based inputs directly in the UI

## 3. Feature Interdependencies and Robustness Considerations

### 3.1 Existing Features Overview

To ensure our enhancements don't break existing functionality, we need to carefully consider how our changes interact with the following key features:

1. **Block Connection System**:
   - Blocks currently connect via global input/output nodes
   - Connections are visually represented by SVG lines
   - Connection data is stored in `block_connections` object

2. **Code Generation**:
   - `export_to_python()` method creates executable Python code
   - Relies on correct block ordering and connection information
   - Uses `_determine_execution_order()` to establish dependencies

3. **Pipeline Execution**:
   - Blocks execute in dependency order
   - Block outputs are propagated to connected inputs
   - Debug mode allows partial pipeline execution

4. **Custom Block Creation**:
   - Users can create custom blocks from LangChain components
   - Block definitions are stored in session storage
   - Methods are discovered from LangChain class inspection

5. **Canvas Management**:
   - Blocks can be positioned, deleted, and connected on canvas
   - Positions and connections are preserved during use
   - Canvas state is serialized for export

### 3.2 Sensitive Dependencies

The following aspects require special attention when implementing method-specific I/O nodes:

1. **Connection Management**:
   - Current system assumes 1:1 relationship between blocks
   - New system needs to track which method's nodes are connected
   - Connection storage format needs to be extended

2. **Code Generation**:
   - Function call generation currently assumes global inputs/outputs
   - Method-specific code generation requires tracking selected methods
   - Parameter handling needs updating for specialized input types

3. **Pipeline Execution**:
   - Execution order algorithm must respect method-specific dependencies
   - Data propagation needs to route to/from the correct method's I/O
   - Partial execution must respect method selection

4. **Serialization**:
   - Block state including selected method must be preserved
   - Method-specific I/O configuration must be serialized properly
   - Backward compatibility is needed for existing serialized blocks

### 3.3 Backward Compatibility Strategy

To ensure our changes don't break existing functionality, we'll implement:

1. **Data Model Compatibility Layer**:
   - Extend Block class without modifying existing properties
   - Map global inputs/outputs to __init__ method by default
   - Ensure all functions check for method-specific I/O but fall back to global I/O

2. **UI Compatibility**:
   - Default to showing __init__ method for existing blocks
   - Preserve global I/O node appearance and behavior
   - Attach method selection functionality without disrupting existing interactions

3. **API Versioning**:
   - Add version parameter to API endpoints
   - Support both legacy and new formats
   - Implement automatic conversion between formats

4. **Progressive Enhancement**:
   - Implement feature in layers, ensuring each layer works with existing functionality
   - Add automated tests for regression prevention
   - Implement validation to prevent invalid configurations

### 3.4 Cross-Feature Migration Paths

For each existing feature, we'll provide migration paths:

1. **Connection System**:
   - Existing connections will be mapped to __init__ method I/O
   - Connection data structure will be extended to include method information
   - UI will update to show method context for connections

2. **Code Generation**:
   - Code generator will detect method-specific connections
   - Multiple connected methods will generate appropriate function calls
   - Parameter handling will be enhanced for specialized inputs

3. **Pipeline Execution**:
   - Execution engine will handle both global and method-specific I/O
   - Method information will be preserved during execution
   - Debug mode will respect method-specific configurations

4. **Custom Block Creation**:
   - Existing block creation workflow will seamlessly transition to method-specific
   - Method configuration will become more granular
   - All existing block types will continue to work

## 4. Implementation Plan

### 4.1 Data Model Changes

#### 4.1.1 Extended Block Class Structure

```javascript
// Current structure (simplified)
{
  inputs: { "input1": BlockInstance1, ... },
  outputs: { "output1": BlockInstance1, ... },
  methods: ["__init__", "method1", "method2"],
  parameters: { /* parameters */ }
}

// New structure
{
  inputs: { "input1": BlockInstance1, ... },  // Global inputs (from __init__)
  outputs: { "output1": BlockInstance1, ... }, // Global outputs (from __init__)
  methods: ["__init__", "method1", "method2"],
  parameters: { /* parameters */ },
  parameter_types: {  // Store parameter types for specialized UI
    "method1": {
      "param1": "file",
      "param2": "folder",
      "param3": "text",
      "param4": "number",
      "param5": "dropdown"
    }
  },
  parameter_options: {  // Store options for dropdowns, etc.
    "method1": {
      "param5": ["option1", "option2", "option3"]
    }
  },
  method_inputs: {
    "__init__": ["global_input1", "global_input2"],
    "method1": ["input1", "input2"],
    "method2": ["input3"]
  },
  method_outputs: {
    "__init__": ["global_output1"],
    "method1": ["output1"],
    "method2": ["output2", "output3"]
  }
}
```

### 4.2 UI Changes

#### 4.2.1 Revised Block Creation Flow

1. Choose Block Type (unchanged)
2. Add Methods (unchanged)
3. Combined Parameter & I/O Configuration
   - For each method (including `__init__`):
     - Configure method parameters with enhanced input types
     - Configure method input nodes
     - Configure method output nodes

#### 4.2.2 Enhanced Parameter Input Types

The following parameter input types will be supported:

1. **Text** - Standard text input (default)
2. **Number** - Numeric input with optional min/max values
3. **Boolean** - Toggle/checkbox for true/false values
4. **File** - File selector with preview for supported file types (PDF, images, etc.)
5. **Folder** - Directory selector for batch processing
6. **Dropdown** - Selection from predefined options
7. **Multi-select** - Multiple selection from predefined options
8. **JSON** - Structured data input with validation
9. **Code** - Code editor for scripts or queries

#### 4.2.3 Visual Design

```
┌───────────────────────────────────────────────────────────┐
│                 Create Custom LangChain Block              │
└───────────────────────────────────────────────────────────┘

┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│ Choose Block │ │ Add Methods │ │ Configure Methods & I/O │
│     Type     │ │             │ │                         │
└─────────────┘ └─────────────┘ └─────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ Method Configuration                                       │
│                                                           │
│ ┌───────────────────────────────────┐                     │
│ │ __init__                          │ ◀── Global method   │
│ │                                   │                     │
│ │ Parameters:                       │                     │
│ │ ┌────────────────────────────┐    │                     │
│ │ │ model_name:                │    │                     │
│ │ │ [      tinyllama     ▼]    │ ◀── Dropdown input      │
│ │ │                            │                         │
│ │ │ temperature:               │                         │
│ │ │ [     0.75     ] [▼][▲]    │ ◀── Number input        │
│ │ └────────────────────────────┘    │                     │
│ │                                   │                     │
│ │ Input Nodes:  [+] Add Input Node  │                     │
│ │ ┌────────────────────────────┐    │                     │
│ │ │ document (global)          │    │                     │
│ │ └────────────────────────────┘    │                     │
│ │                                   │                     │
│ │ Output Nodes: [+] Add Output Node │                     │
│ │ ┌────────────────────────────┐    │                     │
│ │ │ instance (global)          │    │                     │
│ │ └────────────────────────────┘    │                     │
│ └───────────────────────────────────┘                     │
│                                                           │
│ ┌───────────────────────────────────┐                     │
│ │ load_pdf                         │ ◀── Method specific │
│ │                                   │                     │
│ │ Parameters:                       │                     │
│ │ ┌────────────────────────────┐    │                     │
│ │ │ pdf_path:                  │    │                     │
│ │ │ [____________] [Browse...] │ ◀── File input          │
│ │ │                            │                         │
│ │ │ [PDF Preview Available]    │ ◀── File preview        │
│ │ └────────────────────────────┘    │                     │
│ │                                   │                     │
│ │ Input Nodes:  [+] Add Input Node  │                     │
│ │ ┌────────────────────────────┐    │                     │
│ │ │ texts                      │    │                     │
│ │ └────────────────────────────┘    │                     │
│ │                                   │                     │
│ │ Output Nodes: [+] Add Output Node │                     │
│ │ ┌────────────────────────────┐    │                     │
│ │ │ pages                      │    │                     │
│ │ └────────────────────────────┘    │                     │
│ └───────────────────────────────────┘                     │
│                                                           │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ [Previous]                     [Next]       [Create Block] │
└───────────────────────────────────────────────────────────┘
```

#### 4.2.4 Block Display on Canvas with Enhanced Parameters

Blocks will have method selector, parameter configuration panel, and method-specific I/O nodes:

```
┌─────────────────────────────────────┐
│ PyPDFLoader                        │
├─────────────────────────────────────┤
│                                     │
│ Method: [load_pdf ▼]               │
│                                     │
│ Parameters:                         │
│ pdf_path: [example.pdf] [Browse...] │
│                                     │
│ ●───▶ input                         │
│                                     │
│                     pages ◀───●     │
│                                     │
└─────────────────────────────────────┘
```

### 4.3 Code Changes

#### 4.3.1 Frontend Changes

1. **custom-block-handler.js**:
   - Modify the `initModal()` function to combine or update tabs
   - Update `updateMethodsContainer()` to include I/O node configuration per method
   - Update `updateParametersContainer()` to include specialized input types based on parameter
   - Add new methods for file/folder selection with preview capabilities
   - Implement method to detect parameter types based on class documentation or defaults
   - Update `createBlock()` to save method-specific I/O configurations and parameter types

2. **app.js**:
   - Update `createBlock()` to handle method-specific inputs/outputs
   - Add specialized parameter UI components (file browser, folder selector, etc.)
   - Implement file/folder preview functionality for supported types
   - Modify connection handling to respect method-specific nodes
   - Update block UI to include method selector dropdown and parameter configuration panel
   - Add event listeners for method selection that updates visible I/O nodes and parameters

#### 4.3.2 Backend Changes

1. **server.py**:
   - Update `/api/blocks/create_custom` endpoint to accept method-specific I/O nodes
   - Add endpoints for file/folder browsing and selection
   - Implement file preview generation for supported types (PDF thumbnails, etc.)
   - Add parameter type detection based on method signatures and docstrings
   - Modify block creation logic to store parameter type information
   - Update API response to include method-specific I/O data and parameter types

2. **blocks.py**:
   - Extend the `Block` class to store method-specific I/O definitions
   - Add parameter type information to the Block class
   - Update `validate_connections()` to consider method-specific constraints
   - Modify code generation to utilize method-specific connections
   - Enhance file/folder handling for blocks that require file system access

### 4.4 Storing Method-Specific I/O and Parameter Type Data

The method-specific I/O nodes and parameter types will be stored in these additional structures:

```python
# In blocks.py
class Block(ABC):
    def __init__(self):
        self.inputs = {}
        self.outputs = {}
        self.import_string = ""
        self.function_string = ""
        self.method_inputs = {}  # Method name -> list of input node names
        self.method_outputs = {}  # Method name -> list of output node names
        self.parameter_types = {}  # Method name -> param name -> param type
        self.parameter_options = {}  # Method name -> param name -> list of options
```

```javascript
// In sessionStorage (for frontend persistence)
{
  "customBlocks": [
    {
      "id": "block-123",
      "className": "PyPDFLoader",
      "methods": ["__init__", "load"],
      "input_nodes": ["global_input1"],  // Global inputs
      "output_nodes": ["global_output1"],  // Global outputs
      "method_inputs": {
        "__init__": ["global_input1"],
        "load": ["file_path"]
      },
      "method_outputs": {
        "__init__": ["global_output1"],
        "load": ["pages"]
      },
      "parameter_types": {
        "__init__": {
          "memory_limit": "number"
        },
        "load": {
          "pdf_path": "file"
        }
      },
      "parameter_options": {
        "__init__": {
          "model_name": ["tinyllama", "llama2", "mistral"]
        }
      }
    }
  ]
}
```

### 4.5 Parameter Type Detection and Inference

To improve user experience, the system will attempt to automatically detect appropriate parameter types:

1. **File parameters**: Parameters with names containing "file", "path", "pdf", etc.
2. **Folder parameters**: Parameters with names containing "dir", "folder", "directory"
3. **Numeric parameters**: Parameters with default numeric values or type hints
4. **Boolean parameters**: Parameters with default boolean values or type hints
5. **Dropdown parameters**: Parameters with documented enum values or limited options

This detection will be based on:
- Method signature analysis
- Default parameter values
- Python type hints
- Docstring parsing
- Common naming conventions

## 5. Implementation Strategy for Maintaining Robustness

### 5.1 Phased Implementation Approach

To minimize disruption to existing functionality, we'll implement changes in discrete phases:

1. **Foundation Phase**:
   - Add method-specific I/O structures to data model
   - Implement backward compatibility layer
   - Add automated tests for existing functionality
   - Set up feature flags to control rollout

2. **Backend Enhancement Phase**:
   - Extend API endpoints to support method-specific I/O
   - Implement parameter type detection
   - Update validation logic
   - Enhance code generation while maintaining backward compatibility

3. **UI Enhancement Phase**:
   - Update block creation UI
   - Implement parameter-specific input components
   - Add method selector to blocks
   - Test with existing workflows

4. **Finalization Phase**:
   - Complete integration testing
   - Add UI polish and improvements
   - Remove temporary compatibility code
   - Update documentation

### 5.2 Testing Strategy for Robustness

To ensure our changes don't break existing functionality:

1. **Comprehensive Regression Testing**:
   - Create test cases covering all existing block types
   - Test all connection scenarios
   - Verify code generation produces equivalent outputs
   - Test pipeline execution with and without method-specific features

2. **Component-Level Testing**:
   - Unit tests for parameter type detection
   - Test specialized input components
   - Verify backward compatibility functions

3. **Integration Testing**:
   - End-to-end tests for complete workflows
   - Test transitions between old and new formats
   - Test boundary conditions and error cases

4. **Automated Testing Pipeline**:
   - Implement CI/CD pipeline for testing
   - Add visual regression tests for UI
   - Implement load and performance testing

### 5.3 Fallback Mechanisms

To ensure robustness, we'll implement fallback mechanisms:

1. **Data Model Fallbacks**:
   - If method-specific I/O is not found, fall back to global I/O
   - Auto-map global I/O to __init__ method

2. **UI Fallbacks**:
   - Default parameter types if detection fails
   - Graceful degradation for unsupported browsers

3. **Feature Toggles**:
   - Allow disabling method-specific features at runtime
   - Support progressive enablement

### 5.4 Migration of Existing Objects

To handle existing blocks and pipelines:

1. **Block Migration**:
   - Add migration function to update existing blocks
   - Preserve original configuration in case rollback is needed
   - Implement validation to confirm migration success

2. **Pipeline Migration**:
   - Automatic upgrading of pipeline format
   - Validate connections after migration
   - Preserve original pipeline in case rollback is needed

3. **Session Data Migration**:
   - Migrate blocks in sessionStorage
   - Update connection data format
   - Map existing connections to appropriate methods

## 6. Implementation Steps

### 6.1 Phase 1: Backend Updates

1. Update `Block` class in `blocks.py` to support method-specific I/O nodes and parameter types
2. Implement parameter type detection and inference algorithms
3. Extend API endpoints in `server.py` to handle method-specific I/O configurations and parameter types
4. Add file/folder browsing and preview endpoints
5. Update Block serialization/deserialization for the new data structure

### 6.2 Phase 2: UI Updates

1. Create specialized parameter input components (file selector, folder browser, etc.)
2. Implement file/folder preview functionality
3. Modify block creation modal to support per-method I/O configuration
4. Update the UI to display method-specific fields and specialized parameter inputs
5. Add event handlers for method-specific I/O node management

### 6.3 Phase 3: Canvas and Connection Handling

1. Update block rendering to display method-specific nodes
2. Add method selector dropdown to blocks
3. Add parameter configuration panel to blocks
4. Update connection logic to respect method-specific connections
5. Implement dynamic UI updates when method selection changes
6. Update block processing to utilize the correct method's I/O nodes and parameters

### 6.4 Phase 4: Code Generation

1. Update code generation to incorporate method-specific node connections
2. Generate appropriate function calls based on connected inputs and outputs
3. Handle file/folder parameters correctly in generated code
4. Ensure proper error handling for file operations

## 7. Visual Representation of Method-Specific Block Connections with Parameter Configuration

### 7.1 PyPDF + Vector Storage Example

```
┌─────────────────┐                  ┌───────────────────┐
│                 │                  │                   │
│    PyPDF        │                  │  Vector Storage   │
│                 │                  │                   │
│ Method: load_pdf▼│                  │ Method: from_docs▼│
│                 │                  │                   │
│ pdf_path:       │                  │                   │
│ [example.pdf]   │                  │                   │
│ [Browse...]     │                  │                   │
│                 │                  │                   │
│     ●──────────────────────────────→●                 │
│ output          │                  │ documents        │
│                 │                  │                   │
│                 │                  │     ●←────────┐   │
│                 │                  │ embeddings    │   │
│                 │                  │               │   │
└─────────────────┘                  └───────────────┘   │
                                                         │
                                     ┌───────────────────┐
                                     │                   │
                                     │    Embeddings     │
                                     │                   │
                                     │ Method: embed_docs▼│
                                     │                   │
                                     │ model_name:       │
                                     │ [nomic-embed-text]│
                                     │                   │
                                     │     ●             │
                                     │     │             │
                                     └─────┘             │
```

### 7.2 Batch Processing with Folder Selection

```
┌─────────────────┐                  ┌───────────────────┐
│                 │                  │                   │
│  DirectoryLoader│                  │  Text Splitter    │
│                 │                  │                   │
│ Method: load    ▼│                  │ Method: split_docs▼│
│                 │                  │                   │
│ path:           │                  │ chunk_size:       │
│ [docs/]         │                  │ [1000]            │
│ [Browse...]     │                  │ chunk_overlap:    │
│                 │                  │ [200]             │
│ glob: *.txt     │                  │                   │
│                 │                  │                   │
│     ●──────────────────────────────→●                 │
│ documents       │                  │ input            │
│                 │                  │                   │
│                 │                  │     ●────────┐    │
│                 │                  │ chunks       │    │
│                 │                  │              │    │
└─────────────────┘                  └──────────────┘    │
```

## 8. Challenges and Considerations

1. **Compatibility**: Ensure backward compatibility with existing blocks
2. **File System Access**: Handle file system access securely and consistently across platforms
3. **Connection Management**: Update connection handling for method-specific nodes
4. **UI Complexity**: Balance the added complexity with usability
5. **Performance**: Consider performance impact of dynamic node switching and file previews
6. **Validation**: Ensure proper validation of method-specific connections
7. **Parameter Inference**: Create reliable algorithms for parameter type detection
8. **Preview Generation**: Implement efficient preview generation for different file types

## 9. Testing Strategy

1. **Unit Tests**: Test individual components (parameter type detection, file handling, etc.)
2. **Integration Tests**: Test interactions between components
3. **UI Tests**: Verify the UI correctly displays and manages method-specific nodes and specialized parameter inputs
4. **File System Tests**: Verify file and folder selection works correctly across platforms
5. **End-to-End Tests**: Test complete workflows with method-specific connections and different parameter types

## 10. Conclusion

This enhancement will significantly improve the flexibility and capability of the RAG Pipeline Builder by allowing method-specific input and output nodes along with specialized parameter configuration. The implementation requires careful coordination between frontend and backend changes, but the result will be a more powerful and intuitive system that better reflects the actual behavior of LangChain components.

By allowing users to specify which inputs and outputs are associated with each method and providing specialized input mechanisms for different parameter types, we create a more accurate and user-friendly representation of how blocks interact within the pipeline, enabling more complex and effective workflows.