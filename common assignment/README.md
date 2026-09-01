# OmniOpt — Scientific Computing Compiler & Intermediate Code Generator

OmniOpt is an intermediate code generation and multi-pass compiler optimization workbench designed for scientific and financial computing domain-specific languages (DSLs).

![OmniOpt Compiler](https://img.shields.io/badge/Language-HTML5%20%7C%20ES6%20%7C%20Python-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🌟 Key Features

1. **Abstract Syntax Tree (AST) Generation**:
   - Recursive-descent Pratt parser with operator precedence support for arbitrary arithmetic expressions, parentheses, and powers (`^`, `**`).
   - Dynamic SVG visualizer for AST graph exploration.
2. **Three-Address Code (TAC)**:
   - Synthesizes normalized intermediate instructions with register temporary allocations (`t0`, `t1`, `t2`...).
3. **Quadruple & Triple Representations**:
   - Quadruple tables: `(Op, Arg1, Arg2, Result)`.
   - Direct Triples and Indirect Triples pointer array `p[i] -> (j)` for optimal target machine mapping and code motion.
4. **Multi-Pass Compiler Optimizations**:
   - **Constant Folding & Propagation**: Evaluates literal arithmetic and algebraic identities at compile time ($x \times 1 = x$, $x \times 0 = 0$, $x^1 = x$).
   - **Common Subexpression Elimination (CSE)**: Value numbering & commutative canonical hashing to remove redundant computation subtrees.
   - **Dead Code Elimination (DCE) & Copy Propagation**: Prunes unused temporaries and compacts register pressure.
5. **Interactive Workbench UI & CLI Engine**:
   - Cyberpunk dark glassmorphism web interface with real-time editing, preset formulas, and step-by-step optimization inspector.
   - Python CLI tool with full terminal output and automated numerical equivalence benchmarks.

---

## 🚀 Quick Start

### 1. Interactive Web Interface
Simply open `index.html` in your web browser:
```bash
# Or serve locally using python
python -m http.server 4321
```
Open `http://localhost:4321` in your browser.

### 2. Python CLI Compiler Engine
```bash
# Run with default financial equation
python compiler_engine.py

# Run with custom equation
python compiler_engine.py --expr "energy = (0.5 * mass * velocity^2) + (mass * gravity * height) + (0.5 * mass * velocity^2)"
```

### 3. Automated Benchmark & Verification Suite
```bash
python test_suite.py
```

---

## 📂 Project Structure

```
.
├── index.html           # Main Web UI interface
├── style.css            # Dark theme glassmorphism styling
├── compiler.js          # JS AST Parser, TAC, Quadruples, Triples & Optimizer Engine
├── compiler_engine.py   # Standalone Python CLI Compiler & Optimizer
├── test_suite.py        # Automated test suite & numerical equivalence validator
└── README.md            # Project documentation
```

---

## 📜 License
MIT License.
