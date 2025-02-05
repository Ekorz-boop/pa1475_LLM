# LLM RAG Visual Programming Interface Features

## Current Features
- [x] Basic block system with drag and drop
- [x] Connection system between blocks
- [x] Run All button to execute computations
- [x] Block shadows and visual feedback
- [x] Basic block connection system

## Core Block Types To Implement
- [ ] Document Loading Blocks
  - [ ] Text File Loader
  - [ ] PDF Loader
  - [ ] Web Page Loader
  - [ ] Database Loader
  - [ ] CSV/Excel Loader
  - Visual feedback during loading

- [ ] Text Processing Blocks
  - [ ] Text Splitter (Chunk size, overlap)
  - [ ] Text Cleaning
  - [ ] Language Detection
  - [ ] Format Conversion
  - [ ] Metadata Extraction

- [ ] Embedding Blocks
  - [ ] OpenAI Embeddings
  - [ ] HuggingFace Embeddings
  - [ ] Custom Embedding Models
  - [ ] Batch Processing
  - Configuration options for each

- [ ] Vector Store Blocks
  - [ ] FAISS Integration
  - [ ] Chroma Integration
  - [ ] Pinecone Integration
  - [ ] Weaviate Integration
  - Storage and retrieval options

- [ ] Retrieval Blocks
  - [ ] Similarity Search
  - [ ] MMR Retrieval
  - [ ] Hybrid Search
  - [ ] Time-weighted Retrieval
  - Configurable K values and parameters

- [ ] LLM Blocks
  - [ ] OpenAI GPT Models
  - [ ] Anthropic Claude
  - [ ] Local LLMs
  - [ ] Model Configuration
  - Temperature and other parameters

- [ ] Chain Blocks
  - [ ] Stuff Chain
  - [ ] Refine Chain
  - [ ] Map Reduce Chain
  - [ ] Custom Chain Builder
  - Chain configuration options

- [ ] Prompt Blocks
  - [ ] Template Creation
  - [ ] Few-shot Examples
  - [ ] Dynamic Prompting
  - [ ] System Message Configuration

- [ ] Output/Display Blocks
  - [ ] Response Display
  - [ ] Source Citations
  - [ ] Confidence Scores
  - [ ] Debug Information
  - [ ] Markdown Rendering

## UI Improvements
- [ ] Block Management
  - [ ] Delete blocks (sexy red button in the top right corner of the block)
  - [ ] Undo/redo block operations

- [ ] Connection Management
  - [ ] Type-safe connections
  - [ ] Data flow visualization
  - [ ] Connection validation
  - [ ] Error highlighting

- [ ] Canvas Features
  - [ ] Pan and zoom
  - [ ] Auto-layout
  - [ ] Block categorization
  - [ ] Search/filter blocks
  - [ ] Template system

## Advanced Features
- [ ] RAG Pipeline Optimization
  - [ ] Chunk size optimization
  - [ ] Embedding model selection
  - [ ] Retrieval strategy tuning
  - [ ] Performance metrics

- [ ] Memory Systems
  - [ ] Conversation Memory
  - [ ] Vector Store Memory
  - [ ] Custom Memory Types
  - [ ] Memory Visualization

- [ ] Export/Import
  - [ ] Save/load pipelines
  - [ ] Export as Langchain code
  - [ ] Pipeline templates
  - [ ] Configuration profiles

## Backend Integration
- [ ] Data Management
  - [ ] Document storage
  - [ ] Vector store persistence
  - [ ] Model caching
  - [ ] Pipeline state management

- [ ] Processing Engine
  - [ ] Async processing
  - [ ] Batch processing
  - [ ] Error handling
  - [ ] Progress tracking

- [ ] API Features
  - [ ] RESTful endpoints
  - [ ] WebSocket updates
  - [ ] Authentication
  - [ ] Rate limiting

## Known Issues
1. Dragging the blocks only works when selecting the block in some parts of the blocks
2. Output doesnt work (display block)
3. Linking the under the hood connection doesnt work