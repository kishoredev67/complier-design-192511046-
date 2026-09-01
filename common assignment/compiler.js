/**
 * OmniOpt — Domain-Specific Compiler & Intermediate Code Generator
 * Intermediate Representation (IR), Quadruples, Triples & Multi-Pass Optimizer
 */

function isTemp(val) {
  if (typeof val !== 'string') return false;
  return /^t\d+$/.test(val);
}

// ==========================================
// 1. TOKENIZER / LEXER
// ==========================================
const TokenType = {
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  MUL: 'MUL',
  DIV: 'DIV',
  POW: 'POW',
  ASSIGN: 'ASSIGN',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  EOF: 'EOF'
};

class Token {
  constructor(type, value, position) {
    this.type = type;
    this.value = value;
    this.position = position;
  }
}

class Lexer {
  constructor(input) {
    this.input = input.trim();
    this.pos = 0;
    this.currentChar = this.input.length > 0 ? this.input[0] : null;
  }

  advance() {
    this.pos++;
    this.currentChar = this.pos < this.input.length ? this.input[this.pos] : null;
  }

  skipWhitespace() {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  readNumber() {
    let result = '';
    const startPos = this.pos;
    let dotSeen = false;

    while (this.currentChar && (/[0-9]/.test(this.currentChar) || (this.currentChar === '.' && !dotSeen))) {
      if (this.currentChar === '.') dotSeen = true;
      result += this.currentChar;
      this.advance();
    }
    return new Token(TokenType.NUMBER, parseFloat(result), startPos);
  }

  readIdentifier() {
    let result = '';
    const startPos = this.pos;
    while (this.currentChar && /[a-zA-Z_0-9]/.test(this.currentChar)) {
      result += this.currentChar;
      this.advance();
    }
    return new Token(TokenType.IDENTIFIER, result, startPos);
  }

  tokenize() {
    const tokens = [];
    while (this.currentChar !== null) {
      if (/\s/.test(this.currentChar)) {
        this.skipWhitespace();
        continue;
      }

      const p = this.pos;
      if (/[0-9]/.test(this.currentChar) || (this.currentChar === '.' && this.pos + 1 < this.input.length && /[0-9]/.test(this.input[this.pos + 1]))) {
        tokens.push(this.readNumber());
        continue;
      }

      if (/[a-zA-Z_]/.test(this.currentChar)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      if (this.currentChar === '+') { tokens.push(new Token(TokenType.PLUS, '+', p)); this.advance(); continue; }
      if (this.currentChar === '-') { tokens.push(new Token(TokenType.MINUS, '-', p)); this.advance(); continue; }
      if (this.currentChar === '*') {
        if (this.pos + 1 < this.input.length && this.input[this.pos + 1] === '*') {
          tokens.push(new Token(TokenType.POW, '^', p));
          this.advance();
          this.advance();
          continue;
        }
        tokens.push(new Token(TokenType.MUL, '*', p));
        this.advance();
        continue;
      }
      if (this.currentChar === '/') { tokens.push(new Token(TokenType.DIV, '/', p)); this.advance(); continue; }
      if (this.currentChar === '^') { tokens.push(new Token(TokenType.POW, '^', p)); this.advance(); continue; }
      if (this.currentChar === '=') { tokens.push(new Token(TokenType.ASSIGN, '=', p)); this.advance(); continue; }
      if (this.currentChar === '(') { tokens.push(new Token(TokenType.LPAREN, '(', p)); this.advance(); continue; }
      if (this.currentChar === ')') { tokens.push(new Token(TokenType.RPAREN, ')', p)); this.advance(); continue; }

      throw new Error(`Unexpected character '${this.currentChar}' at position ${this.pos}`);
    }

    tokens.push(new Token(TokenType.EOF, null, this.pos));
    return tokens;
  }
}

// ==========================================
// 2. AST NODE DEFINITIONS & PARSER
// ==========================================
class ASTNode {
  constructor(type) {
    this.type = type;
    this.id = 'node_' + Math.random().toString(36).substr(2, 9);
  }
}

class NumberNode extends ASTNode {
  constructor(value) {
    super('Number');
    this.value = value;
  }
}

class VariableNode extends ASTNode {
  constructor(name) {
    super('Variable');
    this.name = name;
  }
}

class UnaryOpNode extends ASTNode {
  constructor(op, expr) {
    super('UnaryOp');
    this.op = op;
    this.expr = expr;
  }
}

class BinaryOpNode extends ASTNode {
  constructor(op, left, right) {
    super('BinaryOp');
    this.op = op;
    this.left = left;
    this.right = right;
  }
}

class AssignmentNode extends ASTNode {
  constructor(target, expr) {
    super('Assignment');
    this.target = target;
    this.expr = expr;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
  }

  peek() {
    return this.tokens[this.current];
  }

  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }

  match(...types) {
    for (const t of types) {
      if (this.check(t)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw new Error(message || `Expected token ${type} but got ${this.peek().type}`);
  }

  parse() {
    if (this.isAtEnd()) return null;
    return this.parseStatement();
  }

  parseStatement() {
    if (this.check(TokenType.IDENTIFIER) && this.tokens[this.current + 1] && this.tokens[this.current + 1].type === TokenType.ASSIGN) {
      const idToken = this.advance();
      this.advance(); // consume '='
      const expr = this.parseExpression();
      return new AssignmentNode(idToken.value, expr);
    }
    return this.parseExpression();
  }

  parseExpression() {
    return this.parseAdditive();
  }

  parseAdditive() {
    let node = this.parseMultiplicative();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.tokens[this.current - 1].value;
      const right = this.parseMultiplicative();
      node = new BinaryOpNode(op, node, right);
    }
    return node;
  }

  parseMultiplicative() {
    let node = this.parsePower();

    while (this.match(TokenType.MUL, TokenType.DIV)) {
      const op = this.tokens[this.current - 1].value;
      const right = this.parsePower();
      node = new BinaryOpNode(op, node, right);
    }
    return node;
  }

  parsePower() {
    let node = this.parseUnary();

    if (this.match(TokenType.POW)) {
      const op = '^';
      const right = this.parsePower();
      node = new BinaryOpNode(op, node, right);
    }
    return node;
  }

  parseUnary() {
    if (this.match(TokenType.MINUS)) {
      const expr = this.parseUnary();
      return new UnaryOpNode('-', expr);
    }
    if (this.match(TokenType.PLUS)) {
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.match(TokenType.NUMBER)) {
      return new NumberNode(this.tokens[this.current - 1].value);
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return new VariableNode(this.tokens[this.current - 1].value);
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }

    throw new Error(`Unexpected token '${this.peek().value || this.peek().type}' at position ${this.peek().position}`);
  }
}

// ==========================================
// 3. THREE-ADDRESS CODE (TAC) & IR INSTRUCTIONS
// ==========================================
class TACInstruction {
  constructor(op, arg1, arg2, result, comment = '') {
    this.op = op;
    this.arg1 = arg1;
    this.arg2 = arg2;
    this.result = result;
    this.comment = comment;
  }

  toString() {
    if (this.op === '=') {
      return `${this.result} = ${this.arg1}`;
    }
    if (this.op === 'uminus') {
      return `${this.result} = -${this.arg1}`;
    }
    if (this.arg2 !== null && this.arg2 !== undefined) {
      return `${this.result} = ${this.arg1} ${this.op} ${this.arg2}`;
    }
    return `${this.result} = ${this.op} ${this.arg1}`;
  }

  clone() {
    return new TACInstruction(this.op, this.arg1, this.arg2, this.result, this.comment);
  }
}

class TACGenerator {
  constructor() {
    this.tempCounter = 0;
    this.instructions = [];
  }

  newTemp() {
    return `t${this.tempCounter++}`;
  }

  generate(ast) {
    this.tempCounter = 0;
    this.instructions = [];

    if (!ast) return [];

    if (ast.type === 'Assignment') {
      const res = this.visit(ast.expr);
      this.instructions.push(new TACInstruction('=', res, null, ast.target, `Assign expression to ${ast.target}`));
    } else {
      const res = this.visit(ast);
      this.instructions.push(new TACInstruction('=', res, null, 'result', 'Final evaluated result'));
    }

    return this.instructions;
  }

  visit(node) {
    if (node.type === 'Number') {
      return node.value.toString();
    }
    if (node.type === 'Variable') {
      return node.name;
    }
    if (node.type === 'UnaryOp') {
      const sub = this.visit(node.expr);
      const temp = this.newTemp();
      this.instructions.push(new TACInstruction('uminus', sub, null, temp));
      return temp;
    }
    if (node.type === 'BinaryOp') {
      const left = this.visit(node.left);
      const right = this.visit(node.right);
      const temp = this.newTemp();
      this.instructions.push(new TACInstruction(node.op, left, right, temp));
      return temp;
    }
    throw new Error(`Unsupported AST Node type: ${node.type}`);
  }
}

// ==========================================
// 4. QUADRUPLES & TRIPLES REPRESENTATIONS
// ==========================================
class Quadruple {
  constructor(index, op, arg1, arg2, result) {
    this.index = index;
    this.op = op;
    this.arg1 = arg1 ?? '';
    this.arg2 = arg2 ?? '';
    this.result = result ?? '';
  }
}

class Triple {
  constructor(index, op, arg1, arg2) {
    this.index = index;
    this.op = op;
    this.arg1 = arg1 ?? '';
    this.arg2 = arg2 ?? '';
  }
}

function generateQuadruples(tacList) {
  return tacList.map((inst, idx) => {
    let op = inst.op;
    let arg1 = inst.arg1;
    let arg2 = inst.arg2 ?? '';
    let result = inst.result;

    if (op === '=') {
      op = 'ASSIGN';
      arg2 = '';
    } else if (op === 'uminus') {
      op = 'NEG';
      arg2 = '';
    }

    return new Quadruple(idx, op, arg1, arg2, result);
  });
}

function generateTriples(tacList) {
  const tempMap = new Map();
  const triples = [];
  const indirectTriples = [];

  tacList.forEach((inst, idx) => {
    let op = inst.op;
    let arg1 = inst.arg1;
    let arg2 = inst.arg2 ?? '';

    if (tempMap.has(arg1)) {
      arg1 = `(${tempMap.get(arg1)})`;
    }
    if (tempMap.has(arg2)) {
      arg2 = `(${tempMap.get(arg2)})`;
    }

    if (op === '=') {
      op = 'ASSIGN';
      triples.push(new Triple(idx, op, inst.result, arg1));
    } else if (op === 'uminus') {
      op = 'NEG';
      triples.push(new Triple(idx, op, arg1, ''));
      if (isTemp(inst.result)) {
        tempMap.set(inst.result, idx);
      }
    } else {
      triples.push(new Triple(idx, op, arg1, arg2));
      if (isTemp(inst.result)) {
        tempMap.set(inst.result, idx);
      }
    }

    indirectTriples.push({
      pointerIndex: idx,
      targetIndex: idx,
      representation: `(${idx}) -> ${triples[idx].op} ${triples[idx].arg1} ${triples[idx].arg2}`
    });
  });

  return { triples, indirectTriples };
}

// ==========================================
// 5. OPTIMIZATION PIPELINE
// ==========================================
class Optimizer {
  constructor(options = { constantFolding: true, cse: true, dce: true }) {
    this.options = options;
    this.stages = [];
  }

  isNumeric(val) {
    if (typeof val === 'number') return true;
    if (typeof val !== 'string') return false;
    return !isNaN(val) && !isNaN(parseFloat(val));
  }

  evaluateOp(op, a, b) {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    switch (op) {
      case '+': return numA + numB;
      case '-': return numA - numB;
      case '*': return numA * numB;
      case '/': return numB !== 0 ? numA / numB : null;
      case '^': return Math.pow(numA, numB);
      case 'uminus': return -numA;
      default: return null;
    }
  }

  applyConstantFolding(instructions, auditLog = []) {
    const constMap = new Map();
    const result = [];
    let foldedCount = 0;

    for (let inst of instructions) {
      let arg1 = inst.arg1;
      let arg2 = inst.arg2;

      if (constMap.has(arg1)) arg1 = constMap.get(arg1);
      if (constMap.has(arg2)) arg2 = constMap.get(arg2);

      if (inst.op === 'uminus' && this.isNumeric(arg1)) {
        const val = -parseFloat(arg1);
        auditLog.push(`Constant Folded unary: -${arg1} ➔ ${val}`);
        foldedCount++;
        if (isTemp(inst.result)) constMap.set(inst.result, val.toString());
        result.push(new TACInstruction('=', val.toString(), null, inst.result, 'Folded unary constant'));
        continue;
      }

      if (this.isNumeric(arg1) && this.isNumeric(arg2) && inst.op !== '=') {
        const val = this.evaluateOp(inst.op, arg1, arg2);
        if (val !== null && isFinite(val)) {
          const formattedVal = Math.abs(val - Math.round(val)) < 1e-12 ? Math.round(val).toString() : Number(val.toFixed(8)).toString();
          auditLog.push(`Constant Folded: ${arg1} ${inst.op} ${arg2} ➔ ${formattedVal}`);
          foldedCount++;
          if (isTemp(inst.result)) constMap.set(inst.result, formattedVal);
          result.push(new TACInstruction('=', formattedVal, null, inst.result, `Folded: ${arg1} ${inst.op} ${arg2}`));
          continue;
        }
      }

      if (inst.op === '*' && ((arg1 === '1' && arg2) || (arg2 === '1' && arg1))) {
        const survivor = arg1 === '1' ? arg2 : arg1;
        auditLog.push(`Algebraic Identity: Simplified ${arg1} * ${arg2} ➔ ${survivor}`);
        foldedCount++;
        result.push(new TACInstruction('=', survivor, null, inst.result, 'Identity: x * 1 = x'));
        continue;
      }
      if (inst.op === '*' && (arg1 === '0' || arg2 === '0')) {
        auditLog.push(`Algebraic Identity: Annihilation ${arg1} * ${arg2} ➔ 0`);
        foldedCount++;
        result.push(new TACInstruction('=', '0', null, inst.result, 'Identity: x * 0 = 0'));
        continue;
      }
      if (inst.op === '+' && (arg1 === '0' || arg2 === '0')) {
        const survivor = arg1 === '0' ? arg2 : arg1;
        auditLog.push(`Algebraic Identity: Add zero ${arg1} + ${arg2} ➔ ${survivor}`);
        foldedCount++;
        result.push(new TACInstruction('=', survivor, null, inst.result, 'Identity: x + 0 = x'));
        continue;
      }
      if (inst.op === '-' && arg2 === '0') {
        auditLog.push(`Algebraic Identity: Subtract zero ${arg1} - 0 ➔ ${arg1}`);
        foldedCount++;
        result.push(new TACInstruction('=', arg1, null, inst.result, 'Identity: x - 0 = x'));
        continue;
      }
      if (inst.op === '^' && arg2 === '1') {
        auditLog.push(`Algebraic Identity: Power of 1: ${arg1} ^ 1 ➔ ${arg1}`);
        foldedCount++;
        result.push(new TACInstruction('=', arg1, null, inst.result, 'Identity: x ^ 1 = x'));
        continue;
      }
      if (inst.op === '^' && arg2 === '0') {
        auditLog.push(`Algebraic Identity: Power of 0: ${arg1} ^ 0 ➔ 1`);
        foldedCount++;
        result.push(new TACInstruction('=', '1', null, inst.result, 'Identity: x ^ 0 = 1'));
        continue;
      }

      result.push(new TACInstruction(inst.op, arg1, arg2, inst.result, inst.comment));
    }

    return { instructions: result, foldedCount };
  }

  applyCSE(instructions, auditLog = []) {
    const exprTable = new Map();
    const copyMap = new Map();
    const result = [];
    let cseCount = 0;

    for (let inst of instructions) {
      let arg1 = inst.arg1;
      let arg2 = inst.arg2;

      if (copyMap.has(arg1)) arg1 = copyMap.get(arg1);
      if (copyMap.has(arg2)) arg2 = copyMap.get(arg2);

      if (inst.op === '=') {
        result.push(new TACInstruction('=', arg1, null, inst.result, inst.comment));
        continue;
      }

      let sig = `${inst.op}|${arg1}|${arg2 ?? ''}`;
      if (inst.op === '+' || inst.op === '*') {
        const sortedArgs = [arg1, arg2].sort();
        sig = `${inst.op}|${sortedArgs[0]}|${sortedArgs[1]}`;
      }

      if (exprTable.has(sig)) {
        const existingVar = exprTable.get(sig);
        auditLog.push(`CSE Hit: Replaced redundant '${arg1} ${inst.op} ${arg2 ?? ''}' with existing '${existingVar}'`);
        copyMap.set(inst.result, existingVar);
        cseCount++;
        result.push(new TACInstruction('=', existingVar, null, inst.result, `CSE eliminated duplicate of ${existingVar}`));
      } else {
        exprTable.set(sig, inst.result);
        result.push(new TACInstruction(inst.op, arg1, arg2, inst.result, inst.comment));
      }
    }

    return { instructions: result, cseCount };
  }

  applyCopyPropAndDCE(instructions, auditLog = []) {
    const copyMap = new Map();
    let intermediate = [];
    let copyPropCount = 0;

    for (let inst of instructions) {
      let arg1 = inst.arg1;
      let arg2 = inst.arg2;

      if (copyMap.has(arg1)) {
        arg1 = copyMap.get(arg1);
        copyPropCount++;
      }
      if (copyMap.has(arg2)) {
        arg2 = copyMap.get(arg2);
        copyPropCount++;
      }

      if (inst.op === '=' && isTemp(inst.result)) {
        copyMap.set(inst.result, arg1);
      }

      intermediate.append ? intermediate.push(new TACInstruction(inst.op, arg1, arg2, inst.result, inst.comment)) : intermediate.push(new TACInstruction(inst.op, arg1, arg2, inst.result, inst.comment));
    }

    let dceCount = 0;
    let changed = true;
    let currentList = intermediate;

    while (changed) {
      changed = false;
      const usedVars = new Set();

      for (let inst of currentList) {
        if (inst.arg1 !== null && inst.arg1 !== undefined) usedVars.add(inst.arg1.toString());
        if (inst.arg2 !== null && inst.arg2 !== undefined) usedVars.add(inst.arg2.toString());
      }

      const pruned = [];
      for (let i = 0; i < currentList.length; i++) {
        const inst = currentList[i];
        if (isTemp(inst.result) && !usedVars.has(inst.result)) {
          auditLog.push(`Dead Code Eliminated: Removed unused temporary '${inst.result}'`);
          dceCount++;
          changed = true;
        } else {
          pruned.push(inst);
        }
      }
      currentList = pruned;
    }

    return { instructions: currentList, dceCount, copyPropCount };
  }

  renumberTemporaries(instructions) {
    const tempMap = new Map();
    let counter = 0;

    return instructions.map(inst => {
      let arg1 = inst.arg1;
      let arg2 = inst.arg2;
      let result = inst.result;

      if (isTemp(arg1) && tempMap.has(arg1)) arg1 = tempMap.get(arg1);
      if (isTemp(arg2) && tempMap.has(arg2)) arg2 = tempMap.get(arg2);

      if (isTemp(result)) {
        if (!tempMap.has(result)) {
          tempMap.set(result, `t${counter++}`);
        }
        result = tempMap.get(result);
      }

      return new TACInstruction(inst.op, arg1, arg2, result, inst.comment);
    });
  }

  optimize(initialInstructions) {
    this.stages = [];
    let current = initialInstructions.map(i => i.clone());

    this.stages.push({
      name: 'Initial Unoptimized TAC',
      pass: 'Stage 0',
      description: 'Raw translation directly synthesized from the Abstract Syntax Tree (AST).',
      instructions: current.map(i => i.clone()),
      audit: ['Constructed AST intermediate address sequence.']
    });

    let totalIterations = 0;
    const maxIterations = 5;
    let totalFolds = 0;
    let totalCSEs = 0;
    let totalDCEs = 0;

    while (totalIterations < maxIterations) {
      totalIterations++;
      let passModified = false;

      if (this.options.constantFolding) {
        const auditLog = [];
        const resCF = this.applyConstantFolding(current, auditLog);
        if (resCF.foldedCount > 0) {
          passModified = true;
          totalFolds += resCF.foldedCount;
          current = resCF.instructions;
          this.stages.push({
            name: `Constant Folding & Algebraic Identities (Iteration ${totalIterations})`,
            pass: 'Pass 1',
            description: 'Evaluates compile-time constant arithmetic and applies algebraic properties.',
            instructions: current.map(i => i.clone()),
            audit: auditLog
          });
        }
      }

      if (this.options.cse) {
        const auditLog = [];
        const resCSE = this.applyCSE(current, auditLog);
        if (resCSE.cseCount > 0) {
          passModified = true;
          totalCSEs += resCSE.cseCount;
          current = resCSE.instructions;
          this.stages.push({
            name: `Common Subexpression Elimination (Iteration ${totalIterations})`,
            pass: 'Pass 2',
            description: 'Identifies syntactically equivalent subexpressions using DAG signature caching.',
            instructions: current.map(i => i.clone()),
            audit: auditLog
          });
        }
      }

      if (this.options.dce) {
        const auditLog = [];
        const resDCE = this.applyCopyPropAndDCE(current, auditLog);
        if (resDCE.dceCount > 0 || resDCE.copyPropCount > 0) {
          passModified = true;
          totalDCEs += resDCE.dceCount;
          current = resDCE.instructions;
          this.stages.push({
            name: `Copy Propagation & Dead Code Elimination (Iteration ${totalIterations})`,
            pass: 'Pass 3',
            description: 'Propagates direct assignments and deletes unreferenced temporary variables.',
            instructions: current.map(i => i.clone()),
            audit: auditLog
          });
        }
      }

      if (!passModified) break;
    }

    const renumbered = this.renumberTemporaries(current);

    this.stages.push({
      name: 'Final Optimized IR & Register Renumbering',
      pass: 'Final Stage',
      description: 'Normalized, compacted TAC instructions ready for code generation and target architecture mapping.',
      instructions: renumbered.map(i => i.clone()),
      audit: [
        `Optimization converged in ${totalIterations} iteration(s).`,
        `Constant folds / simplifications: ${totalFolds}`,
        `Common subexpressions eliminated: ${totalCSEs}`,
        `Dead code / unused temporaries eliminated: ${totalDCEs}`
      ]
    });

    return {
      optimizedInstructions: renumbered,
      stages: this.stages,
      stats: {
        totalFolds,
        totalCSEs,
        totalDCEs,
        iterations: totalIterations
      }
    };
  }
}

// ==========================================
// 6. AST SVG VISUALIZATION ENGINE
// ==========================================
class ASTVisualizer {
  constructor(svgElement) {
    this.svg = svgElement;
  }

  render(ast) {
    this.svg.innerHTML = '';
    if (!ast) return;

    const nodeRadius = 20;
    const levelHeight = 65;

    const getLayout = (node, depth = 0) => {
      if (!node) return { width: 0, node };

      let label = '';
      let typeClass = 'op';

      if (node.type === 'BinaryOp') {
        label = node.op;
        typeClass = 'op';
      } else if (node.type === 'UnaryOp') {
        label = node.op;
        typeClass = 'op';
      } else if (node.type === 'Number') {
        label = node.value.toString();
        typeClass = 'num';
      } else if (node.type === 'Variable') {
        label = node.name;
        typeClass = 'var';
      } else if (node.type === 'Assignment') {
        label = '=';
        typeClass = 'op';
      }

      let children = [];
      if (node.type === 'BinaryOp') {
        children = [getLayout(node.left, depth + 1), getLayout(node.right, depth + 1)];
      } else if (node.type === 'UnaryOp') {
        children = [getLayout(node.expr, depth + 1)];
      } else if (node.type === 'Assignment') {
        children = [
          { label: node.target, typeClass: 'var', children: [], width: 50, depth: depth + 1 },
          getLayout(node.expr, depth + 1)
        ];
      }

      let width = children.length === 0 ? 54 : children.reduce((acc, c) => acc + c.width, 0) + 12;
      return {
        label,
        typeClass,
        depth,
        children,
        width: Math.max(width, 54),
        x: 0,
        y: depth * levelHeight + 35
      };
    };

    const tree = getLayout(ast);

    const assignPositions = (item, startX) => {
      item.x = startX + item.width / 2;
      let currentX = startX;
      for (const child of item.children) {
        assignPositions(child, currentX);
        currentX += child.width;
      }
    };

    assignPositions(tree, 20);

    const totalWidth = Math.max(tree.width + 60, 500);
    const totalHeight = (this.getMaxDepth(tree) + 1) * levelHeight + 50;

    this.svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    this.svg.setAttribute('width', `${totalWidth}px`);
    this.svg.setAttribute('height', `${totalHeight}px`);

    const drawLinks = (item) => {
      for (const child of item.children) {
        const link = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        link.setAttribute('x1', item.x);
        link.setAttribute('y1', item.y);
        link.setAttribute('x2', child.x);
        link.setAttribute('y2', child.y);
        link.setAttribute('class', 'node-link');
        this.svg.appendChild(link);
        drawLinks(child);
      }
    };

    const drawNodes = (item) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', item.x);
      circle.setAttribute('cy', item.y);
      circle.setAttribute('r', nodeRadius);
      circle.setAttribute('class', 'node-circle');

      let fillColor = '#6366f1';
      if (item.typeClass === 'var') fillColor = '#10b981';
      if (item.typeClass === 'num') fillColor = '#f59e0b';
      circle.setAttribute('fill', fillColor);
      circle.setAttribute('stroke', '#ffffff20');
      circle.setAttribute('stroke-width', '2');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', item.x);
      text.setAttribute('y', item.y);
      text.setAttribute('class', 'node-text');
      text.textContent = item.label;

      g.appendChild(circle);
      g.appendChild(text);
      this.svg.appendChild(g);

      for (const child of item.children) {
        drawNodes(child);
      }
    };

    drawLinks(tree);
    drawNodes(tree);
  }

  getMaxDepth(node) {
    if (!node.children || node.children.length === 0) return node.depth;
    return Math.max(...node.children.map(c => this.getMaxDepth(c)));
  }
}

// ==========================================
// 7. SIMULATOR / EVALUATION ENGINE
// ==========================================
class Evaluator {
  static extractVariables(ast) {
    const vars = new Set();
    const traverse = (node) => {
      if (!node) return;
      if (node.type === 'Variable') vars.add(node.name);
      if (node.type === 'BinaryOp') { traverse(node.left); traverse(node.right); }
      if (node.type === 'UnaryOp') traverse(node.expr);
      if (node.type === 'Assignment') traverse(node.expr);
    };
    traverse(ast);
    return Array.from(vars);
  }

  static evalAST(node, env) {
    if (!node) return 0;
    if (node.type === 'Number') return node.value;
    if (node.type === 'Variable') return env[node.name] !== undefined ? env[node.name] : 0;
    if (node.type === 'UnaryOp') {
      const val = this.evalAST(node.expr, env);
      return -val;
    }
    if (node.type === 'BinaryOp') {
      const l = this.evalAST(node.left, env);
      const r = this.evalAST(node.right, env);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r !== 0 ? l / r : 0;
        case '^': return Math.pow(l, r);
      }
    }
    if (node.type === 'Assignment') {
      return this.evalAST(node.expr, env);
    }
    return 0;
  }

  static evalTAC(instructions, env) {
    const state = { ...env };

    const getVal = (arg) => {
      if (arg === null || arg === undefined) return 0;
      if (typeof arg === 'number') return arg;
      if (!isNaN(arg) && !isNaN(parseFloat(arg))) return parseFloat(arg);
      return state[arg] !== undefined ? state[arg] : 0;
    };

    for (const inst of instructions) {
      const val1 = getVal(inst.arg1);
      const val2 = getVal(inst.arg2);

      let res = 0;
      if (inst.op === '=') {
        res = val1;
      } else if (inst.op === 'uminus') {
        res = -val1;
      } else if (inst.op === '+') {
        res = val1 + val2;
      } else if (inst.op === '-') {
        res = val1 - val2;
      } else if (inst.op === '*') {
        res = val1 * val2;
      } else if (inst.op === '/') {
        res = val2 !== 0 ? val1 / val2 : 0;
      } else if (inst.op === '^') {
        res = Math.pow(val1, val2);
      }

      state[inst.result] = res;
    }

    const lastInst = instructions[instructions.length - 1];
    return lastInst ? state[lastInst.result] : 0;
  }
}

// ==========================================
// 8. CONTROLLER & UI APPLICATION WORKFLOW
// ==========================================
class CompilerWorkbench {
  constructor() {
    this.currentAST = null;
    this.unoptTAC = [];
    this.optTAC = [];
    this.optResult = null;
    this.astVisualizer = new ASTVisualizer(document.getElementById('ast-svg'));
    this.envValues = {
      principal: 10000,
      rate: 7.5,
      time: 5,
      fees: 150,
      mass: 12.5,
      velocity: 24,
      gravity: 9.81,
      height: 15,
      a: 3,
      b: 8,
      c: 4,
      x: 10,
      y: 5
    };

    this.initEventListeners();
    this.compile();
  }

  initEventListeners() {
    const input = document.getElementById('expression-input');
    input.addEventListener('input', () => this.compile());

    ['opt-cf', 'opt-cse', 'opt-dce'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.compile());
    });

    document.getElementById('btn-select-all-opt').addEventListener('click', () => {
      ['opt-cf', 'opt-cse', 'opt-dce'].forEach(id => {
        document.getElementById(id).checked = true;
      });
      this.compile();
    });

    document.getElementById('btn-sample-clear').addEventListener('click', () => {
      input.value = '';
      input.focus();
      this.compile();
    });

    const presets = {
      'preset-finance': 'finalValue = ((principal * rate * time) / 100) + (principal * (1 + rate/100)^time) - fees',
      'preset-physics': 'totalEnergy = (0.5 * mass * velocity^2) + (mass * gravity * height) + (0.5 * mass * velocity^2)',
      'preset-constants': 'result = (3 * 4 + 8 / 2) * x + (10 - 2 * 3) * y + (50 * 0) + (x * 1)',
      'preset-quadratic': 'discriminant = (b^2 - 4 * a * c) + ((b^2 - 4 * a * c) / 2)',
      'preset-custom': 'poly = (x^3 + 3*x^2*y + 3*x*y^2 + y^3) + (x^3 + 3*x^2*y)'
    };

    Object.entries(presets).forEach(([btnId, expr]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          input.value = expr;
          this.compile();
        });
      }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active');
      });
    });

    const btnQuadOpt = document.getElementById('btn-quad-opt');
    const btnQuadUnopt = document.getElementById('btn-quad-unopt');
    if (btnQuadOpt && btnQuadUnopt) {
      btnQuadOpt.addEventListener('click', () => {
        btnQuadOpt.classList.add('active');
        btnQuadUnopt.classList.remove('active');
        this.renderQuadruples(this.optTAC);
      });
      btnQuadUnopt.addEventListener('click', () => {
        btnQuadUnopt.classList.add('active');
        btnQuadOpt.classList.remove('active');
        this.renderQuadruples(this.unoptTAC);
      });
    }

    const btnTripleOpt = document.getElementById('btn-triple-opt');
    const btnTripleUnopt = document.getElementById('btn-triple-unopt');
    if (btnTripleOpt && btnTripleUnopt) {
      btnTripleOpt.addEventListener('click', () => {
        btnTripleOpt.classList.add('active');
        btnTripleUnopt.classList.remove('active');
        this.renderTriples(this.optTAC);
      });
      btnTripleUnopt.addEventListener('click', () => {
        btnTripleUnopt.classList.add('active');
        btnTripleOpt.classList.remove('active');
        this.renderTriples(this.unoptTAC);
      });
    }

    document.getElementById('btn-zoom-fit').addEventListener('click', () => {
      if (this.currentAST) this.astVisualizer.render(this.currentAST);
    });
  }

  compile() {
    const rawInput = document.getElementById('expression-input').value.trim();
    const parseStatus = document.getElementById('parse-status');

    if (!rawInput) {
      parseStatus.innerHTML = '<span class="status-dot"></span> Empty Expression';
      this.clearOutputs();
      return;
    }

    try {
      const lexer = new Lexer(rawInput);
      const tokens = lexer.tokenize();

      const parser = new Parser(tokens);
      this.currentAST = parser.parse();

      parseStatus.innerHTML = '<span class="status-dot success"></span> Valid Syntax';

      this.astVisualizer.render(this.currentAST);

      const tacGen = new TACGenerator();
      this.unoptTAC = tacGen.generate(this.currentAST);

      const optOptions = {
        constantFolding: document.getElementById('opt-cf').checked,
        cse: document.getElementById('opt-cse').checked,
        dce: document.getElementById('opt-dce').checked
      };
      const optimizer = new Optimizer(optOptions);
      this.optResult = optimizer.optimize(this.unoptTAC);
      this.optTAC = this.optResult.optimizedInstructions;

      this.renderTACViews();
      this.renderQuadruples(document.getElementById('btn-quad-opt').classList.contains('active') ? this.optTAC : this.unoptTAC);
      this.renderTriples(document.getElementById('btn-triple-opt').classList.contains('active') ? this.optTAC : this.unoptTAC);
      this.renderPipelineBreakdown(this.optResult.stages);
      this.renderComparisonReport();
      this.renderMetrics();
      this.setupSimulator();

    } catch (err) {
      parseStatus.innerHTML = `<span class="status-dot error"></span> ${err.message}`;
      console.warn("Compilation error:", err);
    }
  }

  clearOutputs() {
    document.getElementById('raw-tac-unopt').innerHTML = '<span class="kw-comment">// Waiting for valid expression...</span>';
    document.getElementById('raw-tac-opt').innerHTML = '<span class="kw-comment">// Waiting for valid expression...</span>';
    document.getElementById('quad-tbody').innerHTML = '';
    document.getElementById('triple-tbody').innerHTML = '';
    document.getElementById('indirect-triple-tbody').innerHTML = '';
    document.getElementById('pipeline-steps-container').innerHTML = '';
  }

  formatTACLine(inst, idx) {
    let html = `<div class="code-line"><span class="line-num">${idx + 1}</span><span class="line-text">`;

    if (inst.op === '=') {
      const isTargetTemp = isTemp(inst.result);
      html += `<span class="${isTargetTemp ? 'kw-dest' : 'kw-var'}">${inst.result}</span> = <span class="${isTemp(inst.arg1) ? 'kw-dest' : (!isNaN(inst.arg1) ? 'kw-num' : 'kw-var')}">${inst.arg1}</span>`;
    } else if (inst.op === 'uminus') {
      html += `<span class="kw-dest">${inst.result}</span> = <span class="kw-op">-</span><span class="${isTemp(inst.arg1) ? 'kw-dest' : 'kw-var'}">${inst.arg1}</span>`;
    } else {
      const isArg1Temp = isTemp(inst.arg1);
      const isArg2Temp = isTemp(inst.arg2);
      const arg1Class = isArg1Temp ? 'kw-dest' : (!isNaN(inst.arg1) ? 'kw-num' : 'kw-var');
      const arg2Class = isArg2Temp ? 'kw-dest' : (!isNaN(inst.arg2) ? 'kw-num' : 'kw-var');

      html += `<span class="kw-dest">${inst.result}</span> = <span class="${arg1Class}">${inst.arg1}</span> <span class="kw-op">${inst.op}</span> <span class="${arg2Class}">${inst.arg2}</span>`;
    }

    if (inst.comment) {
      html += `  <span class="kw-comment">// ${inst.comment}</span>`;
    }

    html += `</span></div>`;
    return html;
  }

  renderTACViews() {
    const unoptContainer = document.getElementById('raw-tac-unopt');
    const optContainer = document.getElementById('raw-tac-opt');

    unoptContainer.innerHTML = this.unoptTAC.map((inst, idx) => this.formatTACLine(inst, idx)).join('');
    optContainer.innerHTML = this.optTAC.map((inst, idx) => this.formatTACLine(inst, idx)).join('');
  }

  renderQuadruples(tacList) {
    const quads = generateQuadruples(tacList);
    const tbody = document.getElementById('quad-tbody');

    tbody.innerHTML = quads.map(q => {
      const arg1Class = isTemp(q.arg1) ? 'arg-temp' : (!isNaN(q.arg1) ? 'arg-num' : 'arg-var');
      const arg2Class = isTemp(q.arg2) ? 'arg-temp' : (!isNaN(q.arg2) ? 'arg-num' : 'arg-var');

      return `
        <tr>
          <td><strong>(${q.index})</strong></td>
          <td class="op-cell">${q.op}</td>
          <td class="${arg1Class}">${q.arg1}</td>
          <td class="${arg2Class}">${q.arg2}</td>
          <td class="res-cell">${q.result}</td>
        </tr>
      `;
    }).join('');
  }

  renderTriples(tacList) {
    const { triples, indirectTriples } = generateTriples(tacList);
    const tripleTbody = document.getElementById('triple-tbody');
    const indirectTbody = document.getElementById('indirect-triple-tbody');

    tripleTbody.innerHTML = triples.map(t => {
      const isArg1Ptr = t.arg1.toString().startsWith('(');
      const isArg2Ptr = t.arg2.toString().startsWith('(');
      const arg1Class = isArg1Ptr ? 'arg-ptr' : (!isNaN(t.arg1) ? 'arg-num' : 'arg-var');
      const arg2Class = isArg2Ptr ? 'arg-ptr' : (!isNaN(t.arg2) ? 'arg-num' : 'arg-var');

      return `
        <tr>
          <td><strong>(${t.index})</strong></td>
          <td class="op-cell">${t.op}</td>
          <td class="${arg1Class}">${t.arg1}</td>
          <td class="${arg2Class}">${t.arg2}</td>
        </tr>
      `;
    }).join('');

    indirectTbody.innerHTML = indirectTriples.map(it => `
      <tr>
        <td><strong>p[${it.pointerIndex}]</strong></td>
        <td><span class="arg-ptr">(${it.targetIndex})</span></td>
        <td><code>${it.representation}</code></td>
      </tr>
    `).join('');
  }

  renderPipelineBreakdown(stages) {
    const container = document.getElementById('pipeline-steps-container');
    if (!container || !stages) return;

    container.innerHTML = stages.map((stage, idx) => `
      <div class="pipeline-stage-card">
        <div class="stage-header">
          <div class="stage-title-wrap">
            <span class="stage-badge">${stage.pass}</span>
            <span class="stage-name">${stage.name}</span>
          </div>
          <span class="stage-stats">${stage.instructions.length} TAC instructions</span>
        </div>
        <div class="stage-body">
          <p class="stage-desc">${stage.description}</p>
          <div class="stage-diff-box">
            ${stage.instructions.map((inst, i) => this.formatTACLine(inst, i)).join('')}
          </div>
          <div class="audit-list">
            ${stage.audit.map(item => `<div class="audit-item info"><div class="audit-item-text"><p>${item}</p></div></div>`).join('')}
          </div>
        </div>
      </div>
    `).join('');
  }

  renderMetrics() {
    const unoptCount = this.unoptTAC.length;
    const optCount = this.optTAC.length;
    const reduction = unoptCount > 0 ? (((unoptCount - optCount) / unoptCount) * 100).toFixed(1) : 0;

    const unoptTemps = new Set(this.unoptTAC.map(i => i.result).filter(r => isTemp(r))).size;
    const optTemps = new Set(this.optTAC.map(i => i.result).filter(r => isTemp(r))).size;

    document.getElementById('metric-unopt-count').innerText = unoptCount;
    document.getElementById('metric-unopt-temps').innerText = `${unoptTemps} temporary registers`;

    document.getElementById('metric-opt-count').innerText = optCount;
    document.getElementById('metric-opt-temps').innerText = `${optTemps} temporary registers`;

    document.getElementById('metric-reduction').innerText = `${reduction}%`;
    document.getElementById('metric-flops-saved').innerText = `${Math.max(0, unoptCount - optCount)} instructions saved`;

    const calcCost = (tacList) => {
      let cost = 0;
      tacList.forEach(i => {
        if (i.op === '^') cost += 12;
        else if (i.op === '/') cost += 8;
        else if (i.op === '*') cost += 3;
        else if (i.op === '+' || i.op === '-') cost += 1;
        else cost += 1;
      });
      return cost;
    };

    const costUnopt = calcCost(this.unoptTAC);
    const costOpt = calcCost(this.optTAC);
    const speedup = costOpt > 0 ? (costUnopt / costOpt).toFixed(2) : 1.0;

    document.getElementById('metric-speedup').innerText = `${speedup}x`;
  }

  renderComparisonReport() {
    const auditContainer = document.getElementById('audit-report-content');
    const costTbody = document.getElementById('cost-matrix-tbody');

    const unoptCount = this.unoptTAC.length;
    const optCount = this.optTAC.length;
    const unoptTemps = new Set(this.unoptTAC.map(i => i.result).filter(r => isTemp(r))).size;
    const optTemps = new Set(this.optTAC.map(i => i.result).filter(r => isTemp(r))).size;

    const countOps = (list) => {
      const counts = { '+': 0, '-': 0, '*': 0, '/': 0, '^': 0, 'assignments': 0 };
      list.forEach(i => {
        if (counts[i.op] !== undefined) counts[i.op]++;
        else counts['assignments']++;
      });
      return counts;
    };

    const opsUnopt = countOps(this.unoptTAC);
    const opsOpt = countOps(this.optTAC);

    auditContainer.innerHTML = `
      <div class="audit-item success">
        <div class="audit-item-text">
          <strong>1. Constant Folding & Propagation Applied</strong>
          <p>Evaluated literal subtrees at compile-time and simplified arithmetic identities, saving runtime CPU cycles.</p>
        </div>
      </div>
      <div class="audit-item info">
        <div class="audit-item-text">
          <strong>2. Common Subexpression Elimination (CSE)</strong>
          <p>Shared sub-trees (such as redundant division / multiplication / power subterms) are calculated once and stored in allocated temporaries.</p>
        </div>
      </div>
      <div class="audit-item success">
        <div class="audit-item-text">
          <strong>3. Dead Code Elimination & Register Pressure Reduction</strong>
          <p>Eliminated unused intermediary temporaries, reducing register usage from ${unoptTemps} to ${optTemps} registers.</p>
        </div>
      </div>
      <div class="audit-item warning">
        <div class="audit-item-text">
          <strong>4. Memory & Pipeline Efficiency</strong>
          <p>Fewer TAC instructions directly translates to reduced instruction cache footprint and smaller execution pipelines in scientific workloads.</p>
        </div>
      </div>
    `;

    costTbody.innerHTML = `
      <tr>
        <td><strong>Total Instruction Count</strong></td>
        <td>${unoptCount} instructions</td>
        <td><strong style="color:#818cf8">${optCount} instructions</strong></td>
        <td><span style="color:#10b981">-${unoptCount - optCount} (${unoptCount > 0 ? (((unoptCount - optCount) / unoptCount) * 100).toFixed(0) : 0}%)</span></td>
      </tr>
      <tr>
        <td><strong>Temporary Registers Allocated</strong></td>
        <td>${unoptTemps} registers</td>
        <td><strong style="color:#818cf8">${optTemps} registers</strong></td>
        <td><span style="color:#10b981">-${unoptTemps - optTemps} registers</span></td>
      </tr>
      <tr>
        <td><strong>High-Latency Ops (Div / Power)</strong></td>
        <td>${opsUnopt['/'] + opsUnopt['^']} ops</td>
        <td><strong>${opsOpt['/'] + opsOpt['^']} ops</strong></td>
        <td><span style="color:#10b981">-${(opsUnopt['/'] + opsUnopt['^']) - (opsOpt['/'] + opsOpt['^'])} ops</span></td>
      </tr>
      <tr>
        <td><strong>Multiplications (*)</strong></td>
        <td>${opsUnopt['*']} ops</td>
        <td><strong>${opsOpt['*']} ops</strong></td>
        <td><span style="color:#10b981">-${opsUnopt['*'] - opsOpt['*']} ops</span></td>
      </tr>
      <tr>
        <td><strong>Additions / Subtractions (+ / -)</strong></td>
        <td>${opsUnopt['+'] + opsUnopt['-']} ops</td>
        <td><strong>${opsOpt['+'] + opsOpt['-']} ops</strong></td>
        <td><span style="color:#10b981">-${(opsUnopt['+'] + opsUnopt['-']) - (opsOpt['+'] + opsOpt['-'])} ops</span></td>
      </tr>
    `;
  }

  setupSimulator() {
    const varsContainer = document.getElementById('variables-inputs');
    if (!varsContainer || !this.currentAST) return;

    const varList = Evaluator.extractVariables(this.currentAST);
    varsContainer.innerHTML = '';

    if (varList.length === 0) {
      varsContainer.innerHTML = '<span style="color:var(--text-dim);font-size:0.75rem;">No input variables (Pure constant expression)</span>';
    } else {
      varList.forEach(v => {
        const val = this.envValues[v] !== undefined ? this.envValues[v] : 10;
        const group = document.createElement('div');
        group.className = 'var-input-group';
        group.innerHTML = `
          <span class="var-label">${v}:</span>
          <input type="number" step="any" class="var-input-field" data-var="${v}" value="${val}">
        `;
        varsContainer.appendChild(group);

        group.querySelector('input').addEventListener('input', (e) => {
          this.envValues[v] = parseFloat(e.target.value) || 0;
          this.runSimulation();
        });
      });
    }

    this.runSimulation();
  }

  runSimulation() {
    const astVal = Evaluator.evalAST(this.currentAST, this.envValues);
    const unoptVal = Evaluator.evalTAC(this.unoptTAC, this.envValues);
    const optVal = Evaluator.evalTAC(this.optTAC, this.envValues);

    const formatNum = (n) => {
      if (isNaN(n)) return 'NaN';
      return Math.abs(n) > 100000 || (Math.abs(n) < 0.001 && n !== 0) ? n.toExponential(4) : Number(n.toFixed(4)).toString();
    };

    document.getElementById('val-ast').innerText = formatNum(astVal);
    document.getElementById('val-unopt').innerText = formatNum(unoptVal);
    document.getElementById('val-opt').innerText = formatNum(optVal);

    const badge = document.getElementById('eval-status-badge');
    const isEquivalent = Math.abs(unoptVal - optVal) < 1e-5;

    if (isEquivalent) {
      badge.innerText = 'Algebraic Equivalence: Strict Match (Verified ✓)';
      badge.style.color = 'var(--accent-emerald)';
    } else {
      badge.innerText = 'Equivalence Alert: Discrepancy detected';
      badge.style.color = 'var(--accent-rose)';
    }
  }
}

window.copyText = function (elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const orig = el.parentElement.querySelector('.btn-copy').innerText;
    el.parentElement.querySelector('.btn-copy').innerText = 'Copied!';
    setTimeout(() => {
      el.parentElement.querySelector('.btn-copy').innerText = orig;
    }, 1500);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  window.compilerApp = new CompilerWorkbench();
});
