from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
import os
from tqdm import tqdm
import sys

class Block(ABC):
    def __init__(self):
        self.inputs = {}
        self.outputs = {}
        self.import_string = ""
        self.function_string = ""
    
    @abstractmethod
    def validate_connections(self) -> bool:
        pass

class ChatModelBlock(Block):
    def __init__(self):
        super().__init__()
        self.import_string = """import sys
from tqdm import tqdm
from langchain_community.llms import Ollama"""
        self.function_string = """def create_llm():
    sys.stdout.reconfigure(encoding='utf-8')
    print("🤖 Initializing LLM...")
    with tqdm(total=1, desc="Loading language model") as pbar:
        llm = Ollama(
            model="tinyllama",
            temperature=0.75,
        )
        pbar.update(1)
    print("✅ LLM ready")
    return llm"""
    
    def validate_connections(self) -> bool:
        return True

class EmbeddingBlock(Block):
    def __init__(self):
        super().__init__()
        self.import_string = """import sys
from tqdm import tqdm
from langchain_community.embeddings import OllamaEmbeddings"""
        self.function_string = """def create_embeddings():
    sys.stdout.reconfigure(encoding='utf-8')
    print("🧠 Initializing embeddings model...")
    with tqdm(total=1, desc="Loading embeddings model") as pbar:
        embeddings = OllamaEmbeddings(
            model="nomic-embed-text",
            base_url="http://localhost:11434"
        )
        pbar.update(1)
    print("✅ Embeddings model ready")
    return embeddings"""
    
    def validate_connections(self) -> bool:
        return True

class VectorStoreBlock(Block):
    def __init__(self):
        super().__init__()
        self.import_string = """import sys
from tqdm import tqdm
from langchain_community.vectorstores import FAISS"""
        self.function_string = """def create_vectorstore(documents, embeddings):
    sys.stdout.reconfigure(encoding='utf-8')
    print("🗄️  Creating vector store...")
    with tqdm(total=1, desc="Building FAISS index") as pbar:
        vectorstore = FAISS.from_documents(documents, embeddings)
        pbar.update(1)
    print("✅ Vector store ready")
    return vectorstore"""
    
    def validate_connections(self) -> bool:
        return all(isinstance(inp, (EmbeddingBlock)) for inp in self.inputs.values())

class PDFLoaderBlock(Block):
    def __init__(self):
        super().__init__()
        self.import_string = """import os
import sys
from tqdm import tqdm
from langchain_community.document_loaders import PyPDFLoader"""
        self.function_string = """def load_pdf(pdf_path):
    if pdf_path == 'your_pdf_file.pdf':
        print("Enter the paths to your PDF files (one per line).")
        print("Press Enter twice when done:")
        pdf_paths = []
        while True:
            path = input().strip()
            if not path:
                break
            pdf_paths.append(path)
    else:
        pdf_paths = [pdf_path]
    
    if not pdf_paths:
        raise ValueError("No PDF files provided")
    
    all_pages = []
    sys.stdout.reconfigure(encoding='utf-8')
    print("📄 Loading PDFs...")
    with tqdm(total=len(pdf_paths), desc="Reading documents") as pbar:
        for path in pdf_paths:
            if not os.path.exists(path):
                print(f"⚠️  Warning: File not found: {path}")
                continue
            try:
                loader = PyPDFLoader(path)
                pages = loader.load()
                all_pages.extend(pages)
                print(f"✅ Loaded {len(pages)} pages from {os.path.basename(path)}")
                pbar.update(1)
            except Exception as e:
                print(f"⚠️  Error loading {path}: {str(e)}")
                pbar.update(1)
                continue
    
    if not all_pages:
        raise ValueError("No valid PDF files were loaded")
    
    print(f"📚 Total pages loaded: {len(all_pages)}")
    return all_pages"""
    
    def validate_connections(self) -> bool:
        return True

class TextSplitterBlock(Block):
    def __init__(self):
        super().__init__()
        self.import_string = """import sys
from tqdm import tqdm
from langchain_text_splitters import RecursiveCharacterTextSplitter"""
        self.function_string = """def split_text(documents):
    sys.stdout.reconfigure(encoding='utf-8')
    print("✂️  Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    with tqdm(total=1, desc="Splitting documents") as pbar:
        splits = text_splitter.split_documents(documents)
        pbar.update(1)
    print(f"✅ Created {len(splits)} text chunks")
    return splits"""
    
    def validate_connections(self) -> bool:
        return all(isinstance(inp, PDFLoaderBlock) for inp in self.inputs.values())

class RAGPromptBlock(Block):
    def __init__(self):
        super().__init__()
        self.import_string = """import sys
from tqdm import tqdm
from langchain_core.prompts import PromptTemplate
from langchain.chains import RetrievalQA"""
        self.function_string = """def create_rag_chain(llm, vectorstore):
    sys.stdout.reconfigure(encoding='utf-8')
    print("⚡ Setting up RAG chain...")
    prompt_template = '''Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    
    {context}
    
    Question: {question}
    Answer:'''
    
    with tqdm(total=2, desc="Creating RAG chain") as pbar:
        PROMPT = PromptTemplate(
            template=prompt_template, input_variables=["context", "question"]
        )
        pbar.update(1)
        
        chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=vectorstore.as_retriever(),
            return_source_documents=True,
            chain_type_kwargs={"prompt": PROMPT}
        )
        pbar.update(1)
    print("✅ RAG chain ready")
    print("\n🎉 Setup complete! You can now ask questions about your documents.\n")
    return chain"""
    
    def validate_connections(self) -> bool:
        return all(isinstance(inp, (ChatModelBlock, VectorStoreBlock)) for inp in self.inputs.values())

class Canvas:
    def __init__(self):
        self.blocks: Dict[str, Block] = {}
        self.connections: Dict[str, List[str]] = {}  # source_id -> [target_id]
    
    def add_block(self, block_id: str, block: Block) -> None:
        """Add a block to the canvas."""
        self.blocks[block_id] = block
    
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
            imports.add(block.import_string)
        
        # Collect all functions
        functions = []
        for block in self.blocks.values():
            functions.append(block.function_string)
        
        # Create the main execution flow
        execution_order = self._determine_execution_order()
        main_code = self._generate_main_code(execution_order)
        
        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
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
            f.write("    print('This application will help you analyze a PDF document using AI.')\n")
            f.write("    print('You will be prompted to provide the path to your PDF file.')\n")
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
        
        for block_id in execution_order:
            block = self.blocks[block_id]
            
            if isinstance(block, PDFLoaderBlock):
                code_lines.append(f"    # Load PDF")
                code_lines.append(f"    {block_id}_result = load_pdf('your_pdf_file.pdf')")
                results[block_id] = f"{block_id}_result"
            
            elif isinstance(block, TextSplitterBlock):
                input_var = results[list(block.inputs.keys())[0]]
                code_lines.append(f"    # Split text")
                code_lines.append(f"    {block_id}_result = split_text({input_var})")
                results[block_id] = f"{block_id}_result"
            
            elif isinstance(block, EmbeddingBlock):
                code_lines.append(f"    # Create embeddings")
                code_lines.append(f"    {block_id}_result = create_embeddings()")
                results[block_id] = f"{block_id}_result"
            
            elif isinstance(block, VectorStoreBlock):
                docs_var = results[list(block.inputs.keys())[0]]
                emb_var = results[list(block.inputs.keys())[1]]
                code_lines.append(f"    # Create vector store")
                code_lines.append(f"    {block_id}_result = create_vectorstore({docs_var}, {emb_var})")
                results[block_id] = f"{block_id}_result"
            
            elif isinstance(block, ChatModelBlock):
                code_lines.append(f"    # Create LLM")
                code_lines.append(f"    {block_id}_result = create_llm()")
                results[block_id] = f"{block_id}_result"
            
            elif isinstance(block, RAGPromptBlock):
                llm_var = results[list(block.inputs.keys())[0]]
                vs_var = results[list(block.inputs.keys())[1]]
                code_lines.append(f"    # Create RAG chain")
                code_lines.append(f"    {block_id}_result = create_rag_chain({llm_var}, {vs_var})")
                results[block_id] = f"{block_id}_result"
        
        return "\n".join(code_lines) 