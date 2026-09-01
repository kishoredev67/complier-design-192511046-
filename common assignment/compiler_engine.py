#!/usr/bin/env python3
"""
OmniOpt — Scientific Computing Compiler & Intermediate Code Generation Module
Generates Syntax Trees, Three-Address Code (TAC), Quadruples, Triples & Applies Optimizations.
"""

import sys
import os
import io
import re
import math
import argparse
from typing import List, Dict, Any, Optional, Tuple, Set

# Configure UTF-8 on Windows terminal
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def is_temp(var_name: Any) -> bool:
    """Check if variable is a temporary compiler register (e.g. t0, t1, t2)."""
    if not isinstance(var_name, str):
        return False
    return bool(re.match(r'^t\d+$', var_name))

# =====================================================================
# 1. TOKENIZER & LEXER
# =====================================================================

class TokenType:
    IDENTIFIER = 'IDENTIFIER'
    NUMBER = 'NUMBER'
    PLUS = 'PLUS'
    MINUS = 'MINUS'
    MUL = 'MUL'
    DIV = 'DIV'
    POW = 'POW'
    ASSIGN = 'ASSIGN'
    LPAREN = 'LPAREN'
    RPAREN = 'RPAREN'
    EOF = 'EOF'

class Token:
    def __init__(self, type_: str, value: Any, position: int):
        self.type = type_
        self.value = value
        self.position = position

    def __repr__(self):
        return f"Token({self.type}, {self.value})"

class Lexer:
    def __init__(self, text: str):
        self.text = text
        self.pos = 0
        self.current_char = self.text[0] if text else None

    def advance(self):
        self.pos += 1
        self.current_char = self.text[self.pos] if self.pos < len(self.text) else None

    def skip_whitespace(self):
        while self.current_char and self.current_char.isspace():
            self.advance()

    def read_number(self):
        start = self.pos
        result = ''
        dot = False
        while self.current_char and (self.current_char.isdigit() or (self.current_char == '.' and not dot)):
            if self.current_char == '.':
                dot = True
            result += self.current_char
            self.advance()
        val = float(result) if '.' in result else int(result)
        return Token(TokenType.NUMBER, val, start)

    def read_identifier(self):
        start = self.pos
        result = ''
        while self.current_char and (self.current_char.isalnum() or self.current_char == '_'):
            result += self.current_char
            self.advance()
        return Token(TokenType.IDENTIFIER, result, start)

    def tokenize(self) -> List[Token]:
        tokens = []
        while self.current_char is not None:
            if self.current_char.isspace():
                self.skip_whitespace()
                continue
            
            p = self.pos
            if self.current_char.isdigit() or (self.current_char == '.' and self.pos + 1 < len(self.text) and self.text[self.pos + 1].isdigit()):
                tokens.append(self.read_number())
                continue

            if self.current_char.isalpha() or self.current_char == '_':
                tokens.append(self.read_identifier())
                continue

            if self.current_char == '+':
                tokens.append(Token(TokenType.PLUS, '+', p)); self.advance(); continue
            if self.current_char == '-':
                tokens.append(Token(TokenType.MINUS, '-', p)); self.advance(); continue
            if self.current_char == '*':
                if self.pos + 1 < len(self.text) and self.text[self.pos + 1] == '*':
                    tokens.append(Token(TokenType.POW, '^', p))
                    self.advance(); self.advance(); continue
                tokens.append(Token(TokenType.MUL, '*', p)); self.advance(); continue
            if self.current_char == '/':
                tokens.append(Token(TokenType.DIV, '/', p)); self.advance(); continue
            if self.current_char == '^':
                tokens.append(Token(TokenType.POW, '^', p)); self.advance(); continue
            if self.current_char == '=':
                tokens.append(Token(TokenType.ASSIGN, '=', p)); self.advance(); continue
            if self.current_char == '(':
                tokens.append(Token(TokenType.LPAREN, '(', p)); self.advance(); continue
            if self.current_char == ')':
                tokens.append(Token(TokenType.RPAREN, ')', p)); self.advance(); continue

            raise ValueError(f"Unrecognized character '{self.current_char}' at index {self.pos}")

        tokens.append(Token(TokenType.EOF, None, self.pos))
        return tokens

# =====================================================================
# 2. AST NODES & PARSER
# =====================================================================

class ASTNode:
    pass

class NumberNode(ASTNode):
    def __init__(self, value: float):
        self.value = value

    def __repr__(self):
        return f"Num({self.value})"

class VariableNode(ASTNode):
    def __init__(self, name: str):
        self.name = name

    def __repr__(self):
        return f"Var({self.name})"

class UnaryOpNode(ASTNode):
    def __init__(self, op: str, expr: ASTNode):
        self.op = op
        self.expr = expr

    def __repr__(self):
        return f"UnaryOp({self.op}, {self.expr})"

class BinaryOpNode(ASTNode):
    def __init__(self, op: str, left: ASTNode, right: ASTNode):
        self.op = op
        self.left = left
        self.right = right

    def __repr__(self):
        return f"BinaryOp({self.left} {self.op} {self.right})"

class AssignmentNode(ASTNode):
    def __init__(self, target: str, expr: ASTNode):
        self.target = target
        self.expr = expr

    def __repr__(self):
        return f"Assign({self.target} = {self.expr})"

class Parser:
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.current = 0

    def peek(self) -> Token:
        return self.tokens[self.current]

    def advance(self) -> Token:
        tok = self.peek()
        if tok.type != TokenType.EOF:
            self.current += 1
        return tok

    def match(self, *types) -> bool:
        if self.peek().type in types:
            self.advance()
            return True
        return False

    def consume(self, type_: str, message: str) -> Token:
        if self.peek().type == type_:
            return self.advance()
        raise SyntaxError(message)

    def parse(self) -> ASTNode:
        return self.parse_statement()

    def parse_statement(self) -> ASTNode:
        if self.peek().type == TokenType.IDENTIFIER and self.current + 1 < len(self.tokens) and self.tokens[self.current + 1].type == TokenType.ASSIGN:
            id_tok = self.advance()
            self.advance() # consume '='
            expr = self.parse_expression()
            return AssignmentNode(id_tok.value, expr)
        return self.parse_expression()

    def parse_expression(self) -> ASTNode:
        return self.parse_additive()

    def parse_additive(self) -> ASTNode:
        node = self.parse_multiplicative()
        while self.peek().type in (TokenType.PLUS, TokenType.MINUS):
            op_tok = self.advance()
            right = self.parse_multiplicative()
            node = BinaryOpNode(op_tok.value, node, right)
        return node

    def parse_multiplicative(self) -> ASTNode:
        node = self.parse_power()
        while self.peek().type in (TokenType.MUL, TokenType.DIV):
            op_tok = self.advance()
            right = self.parse_power()
            node = BinaryOpNode(op_tok.value, node, right)
        return node

    def parse_power(self) -> ASTNode:
        node = self.parse_unary()
        if self.match(TokenType.POW):
            right = self.parse_power() # right-associative
            node = BinaryOpNode('^', node, right)
        return node

    def parse_unary(self) -> ASTNode:
        if self.match(TokenType.MINUS):
            return UnaryOpNode('-', self.parse_unary())
        if self.match(TokenType.PLUS):
            return self.parse_unary()
        return self.parse_primary()

    def parse_primary(self) -> ASTNode:
        tok = self.peek()
        if self.match(TokenType.NUMBER):
            return NumberNode(tok.value)
        if self.match(TokenType.IDENTIFIER):
            return VariableNode(tok.value)
        if self.match(TokenType.LPAREN):
            node = self.parse_expression()
            self.consume(TokenType.RPAREN, "Expected closing ')'")
            return node
        raise SyntaxError(f"Unexpected token {tok} at position {tok.position}")

# =====================================================================
# 3. THREE-ADDRESS CODE (TAC) INSTRUCTIONS
# =====================================================================

class TACInstruction:
    def __init__(self, op: str, arg1: Any, arg2: Any, result: str, comment: str = ''):
        self.op = op
        self.arg1 = arg1
        self.arg2 = arg2
        self.result = result
        self.comment = comment

    def __str__(self):
        if self.op == '=':
            return f"{self.result} = {self.arg1}"
        if self.op == 'uminus':
            return f"{self.result} = -{self.arg1}"
        if self.arg2 is not None:
            return f"{self.result} = {self.arg1} {self.op} {self.arg2}"
        return f"{self.result} = {self.op} {self.arg1}"

    def clone(self):
        return TACInstruction(self.op, self.arg1, self.arg2, self.result, self.comment)

class TACGenerator:
    def __init__(self):
        self.temp_count = 0
        self.instructions = []

    def new_temp(self) -> str:
        t = f"t{self.temp_count}"
        self.temp_count += 1
        return t

    def generate(self, ast: ASTNode) -> List[TACInstruction]:
        self.temp_count = 0
        self.instructions = []
        if isinstance(ast, AssignmentNode):
            res = self.visit(ast.expr)
            self.instructions.append(TACInstruction('=', res, None, ast.target, f"Assign to {ast.target}"))
        else:
            res = self.visit(ast)
            self.instructions.append(TACInstruction('=', res, None, 'result', "Final result"))
        return self.instructions

    def visit(self, node: ASTNode) -> str:
        if isinstance(node, NumberNode):
            return str(node.value)
        if isinstance(node, VariableNode):
            return node.name
        if isinstance(node, UnaryOpNode):
            sub = self.visit(node.expr)
            temp = self.new_temp()
            self.instructions.append(TACInstruction('uminus', sub, None, temp))
            return temp
        if isinstance(node, BinaryOpNode):
            left = self.visit(node.left)
            right = self.visit(node.right)
            temp = self.new_temp()
            self.instructions.append(TACInstruction(node.op, left, right, temp))
            return temp
        raise ValueError(f"Unknown AST node {type(node)}")

# =====================================================================
# 4. QUADRUPLES & TRIPLES REPRESENTATIONS
# =====================================================================

class Quadruple:
    def __init__(self, idx: int, op: str, arg1: str, arg2: str, result: str):
        self.idx = idx
        self.op = op
        self.arg1 = arg1
        self.arg2 = arg2
        self.result = result

    def format_row(self) -> str:
        return f"| {self.idx:<4} | {self.op:<8} | {str(self.arg1):<15} | {str(self.arg2 or ''):<15} | {self.result:<12} |"

def generate_quadruples(tac_list: List[TACInstruction]) -> List[Quadruple]:
    quads = []
    for idx, inst in enumerate(tac_list):
        op = 'ASSIGN' if inst.op == '=' else ('NEG' if inst.op == 'uminus' else inst.op)
        arg1 = str(inst.arg1)
        arg2 = str(inst.arg2) if inst.arg2 is not None else ''
        quads.append(Quadruple(idx, op, arg1, arg2, inst.result))
    return quads

class Triple:
    def __init__(self, idx: int, op: str, arg1: str, arg2: str):
        self.idx = idx
        self.op = op
        self.arg1 = arg1
        self.arg2 = arg2

    def format_row(self) -> str:
        return f"| ({self.idx}) | {self.op:<8} | {str(self.arg1):<18} | {str(self.arg2 or ''):<18} |"

def generate_triples(tac_list: List[TACInstruction]) -> Tuple[List[Triple], List[Dict[str, Any]]]:
    temp_map = {}
    triples = []
    indirect_triples = []

    for idx, inst in enumerate(tac_list):
        op = 'ASSIGN' if inst.op == '=' else ('NEG' if inst.op == 'uminus' else inst.op)
        arg1 = str(inst.arg1)
        arg2 = str(inst.arg2) if inst.arg2 is not None else ''

        if arg1 in temp_map:
            arg1 = f"({temp_map[arg1]})"
        if arg2 in temp_map:
            arg2 = f"({temp_map[arg2]})"

        if inst.op == '=':
            triples.append(Triple(idx, op, inst.result, arg1))
        else:
            triples.append(Triple(idx, op, arg1, arg2))
            if is_temp(inst.result):
                temp_map[inst.result] = idx

        indirect_triples.append({
            'ptr': idx,
            'target': idx,
            'repr': f"({idx}) -> {op} {arg1} {arg2}"
        })

    return triples, indirect_triples

# =====================================================================
# 5. MULTI-PASS OPTIMIZER
# =====================================================================

class Optimizer:
    @staticmethod
    def is_number(val: Any) -> bool:
        if isinstance(val, (int, float)):
            return True
        try:
            float(val)
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def eval_op(op: str, a: float, b: float) -> Optional[float]:
        try:
            if op == '+': return a + b
            if op == '-': return a - b
            if op == '*': return a * b
            if op == '/': return a / b if b != 0 else None
            if op == '^': return a ** b
        except OverflowError:
            return None
        return None

    def constant_folding(self, instructions: List[TACInstruction]) -> Tuple[List[TACInstruction], int]:
        const_map = {}
        result = []
        folds = 0

        for inst in instructions:
            arg1 = const_map.get(inst.arg1, inst.arg1)
            arg2 = const_map.get(inst.arg2, inst.arg2) if inst.arg2 is not None else None

            # Unary folding
            if inst.op == 'uminus' and self.is_number(arg1):
                val = -float(arg1)
                val_str = str(int(val)) if val.is_integer() else f"{val:.6g}"
                if is_temp(inst.result):
                    const_map[inst.result] = val_str
                result.append(TACInstruction('=', val_str, None, inst.result, "Folded unary constant"))
                folds += 1
                continue

            # Binary folding
            if self.is_number(arg1) and self.is_number(arg2) and inst.op != '=':
                val = self.eval_op(inst.op, float(arg1), float(arg2))
                if val is not None:
                    val_str = str(int(val)) if val.is_integer() else f"{val:.6g}"
                    if is_temp(inst.result):
                        const_map[inst.result] = val_str
                    result.append(TACInstruction('=', val_str, None, inst.result, f"Folded: {arg1} {inst.op} {arg2}"))
                    folds += 1
                    continue

            # Algebraic identities
            if inst.op == '*' and (arg1 == '1' or arg2 == '1'):
                survivor = arg2 if arg1 == '1' else arg1
                result.append(TACInstruction('=', survivor, None, inst.result, "Identity: x * 1 = x"))
                folds += 1
                continue

            if inst.op == '*' and (arg1 == '0' or arg2 == '0'):
                result.append(TACInstruction('=', '0', None, inst.result, "Identity: x * 0 = 0"))
                folds += 1
                continue

            if inst.op == '+' and (arg1 == '0' or arg2 == '0'):
                survivor = arg2 if arg1 == '0' else arg1
                result.append(TACInstruction('=', survivor, None, inst.result, "Identity: x + 0 = x"))
                folds += 1
                continue

            if inst.op == '-' and arg2 == '0':
                result.append(TACInstruction('=', arg1, None, inst.result, "Identity: x - 0 = x"))
                folds += 1
                continue

            if inst.op == '^' and arg2 == '1':
                result.append(TACInstruction('=', arg1, None, inst.result, "Identity: x ^ 1 = x"))
                folds += 1
                continue

            if inst.op == '^' and arg2 == '0':
                result.append(TACInstruction('=', '1', None, inst.result, "Identity: x ^ 0 = 1"))
                folds += 1
                continue

            result.append(TACInstruction(inst.op, arg1, arg2, inst.result, inst.comment))

        return result, folds

    def cse(self, instructions: List[TACInstruction]) -> Tuple[List[TACInstruction], int]:
        expr_table = {}
        copy_map = {}
        result = []
        cse_hits = 0

        for inst in instructions:
            arg1 = copy_map.get(inst.arg1, inst.arg1)
            arg2 = copy_map.get(inst.arg2, inst.arg2) if inst.arg2 is not None else None

            if inst.op == '=':
                result.append(TACInstruction('=', arg1, None, inst.result, inst.comment))
                continue

            # Commutative signature canonicalization
            if inst.op in ('+', '*'):
                sorted_args = sorted([str(arg1), str(arg2)])
                sig = f"{inst.op}|{sorted_args[0]}|{sorted_args[1]}"
            else:
                sig = f"{inst.op}|{arg1}|{arg2 or ''}"

            if sig in expr_table:
                existing_var = expr_table[sig]
                copy_map[inst.result] = existing_var
                cse_hits += 1
                result.append(TACInstruction('=', existing_var, None, inst.result, f"CSE replaced duplicate of {existing_var}"))
            else:
                expr_table[sig] = inst.result
                result.append(TACInstruction(inst.op, arg1, arg2, inst.result, inst.comment))

        return result, cse_hits

    def copy_prop_and_dce(self, instructions: List[TACInstruction]) -> Tuple[List[TACInstruction], int]:
        # Copy propagation
        copy_map = {}
        intermediate = []
        for inst in instructions:
            arg1 = copy_map.get(inst.arg1, inst.arg1)
            arg2 = copy_map.get(inst.arg2, inst.arg2) if inst.arg2 is not None else None

            if inst.op == '=' and is_temp(inst.result):
                copy_map[inst.result] = arg1

            intermediate.append(TACInstruction(inst.op, arg1, arg2, inst.result, inst.comment))

        # Dead code elimination
        dce_count = 0
        changed = True
        current = intermediate
        while changed:
            changed = False
            used = set()
            for inst in current:
                if inst.arg1 is not None: used.add(str(inst.arg1))
                if inst.arg2 is not None: used.add(str(inst.arg2))

            pruned = []
            for inst in current:
                if is_temp(inst.result) and inst.result not in used:
                    dce_count += 1
                    changed = True
                else:
                    pruned.append(inst)
            current = pruned

        return current, dce_count

    def renumber_temporaries(self, instructions: List[TACInstruction]) -> List[TACInstruction]:
        temp_map = {}
        count = 0
        result = []
        for inst in instructions:
            arg1 = temp_map.get(inst.arg1, inst.arg1)
            arg2 = temp_map.get(inst.arg2, inst.arg2) if inst.arg2 is not None else None
            res = inst.result
            if is_temp(res):
                if res not in temp_map:
                    temp_map[res] = f"t{count}"
                    count += 1
                res = temp_map[res]
            result.append(TACInstruction(inst.op, arg1, arg2, res, inst.comment))
        return result

    def optimize(self, initial: List[TACInstruction]) -> Tuple[List[TACInstruction], Dict[str, Any]]:
        current = [i.clone() for i in initial]
        total_folds, total_cse, total_dce = 0, 0, 0

        for _ in range(5):
            modified = False
            current, f = self.constant_folding(current)
            if f > 0: total_folds += f; modified = True

            current, c = self.cse(current)
            if c > 0: total_cse += c; modified = True

            current, d = self.copy_prop_and_dce(current)
            if d > 0: total_dce += d; modified = True

            if not modified:
                break

        final = self.renumber_temporaries(current)
        stats = {
            'folds': total_folds,
            'cse': total_cse,
            'dce': total_dce,
            'unopt_count': len(initial),
            'opt_count': len(final)
        }
        return final, stats

# =====================================================================
# 6. CLI RUNNER & PRETTY PRINTER
# =====================================================================

def print_banner():
    print("=" * 80)
    print("       OMNIOPT — SCIENTIFIC INTERMEDIATE CODE GENERATOR & OPTIMIZER")
    print("=" * 80)

def main():
    default_expr = "finalValue = ((principal * rate * time) / 100) + (principal * (1 + rate/100)^time) - fees"
    parser = argparse.ArgumentParser(description="Compiler Intermediate Code Generator and Optimizer")
    parser.add_argument("--expr", type=str, default=default_expr, help="Input arithmetic or assignment expression")
    args = parser.parse_args()

    print_banner()
    print(f"\n[1] INPUT DSL EXPRESSION:\n    {args.expr}\n")

    # Lex & Parse
    lexer = Lexer(args.expr)
    tokens = lexer.tokenize()
    parser_obj = Parser(tokens)
    ast = parser_obj.parse()
    print(f"[2] PARSED ABSTRACT SYNTAX TREE (AST):\n    {ast}\n")

    # Unoptimized TAC
    tac_gen = TACGenerator()
    unopt_tac = tac_gen.generate(ast)
    print(f"[3] THREE-ADDRESS CODE (UNOPTIMIZED TAC) — [{len(unopt_tac)} instructions]:")
    for idx, inst in enumerate(unopt_tac, 1):
        print(f"    {idx:<2}. {inst}")
    print()

    # Optimization
    optimizer = Optimizer()
    opt_tac, stats = optimizer.optimize(unopt_tac)
    print(f"[4] OPTIMIZED THREE-ADDRESS CODE (TAC) — [{len(opt_tac)} instructions]:")
    for idx, inst in enumerate(opt_tac, 1):
        print(f"    {idx:<2}. {inst}")
    print()

    # Quadruples
    print(f"[5] QUADRUPLE REPRESENTATION (OPTIMIZED):")
    print("    +" + "-"*6 + "+" + "-"*10 + "+" + "-"*17 + "+" + "-"*17 + "+" + "-"*14 + "+")
    print("    | Idx  | Op       | Arg1            | Arg2            | Result       |")
    print("    +" + "-"*6 + "+" + "-"*10 + "+" + "-"*17 + "+" + "-"*17 + "+" + "-"*14 + "+")
    quads = generate_quadruples(opt_tac)
    for q in quads:
        print(f"    {q.format_row()}")
    print("    +" + "-"*6 + "+" + "-"*10 + "+" + "-"*17 + "+" + "-"*17 + "+" + "-"*14 + "+\n")

    # Triples
    print(f"[6] TRIPLE REPRESENTATION (OPTIMIZED):")
    print("    +" + "-"*6 + "+" + "-"*10 + "+" + "-"*20 + "+" + "-"*20 + "+")
    print("    | Idx  | Op       | Arg1               | Arg2               |")
    print("    +" + "-"*6 + "+" + "-"*10 + "+" + "-"*20 + "+" + "-"*20 + "+")
    triples, indirect = generate_triples(opt_tac)
    for t in triples:
        print(f"    {t.format_row()}")
    print("    +" + "-"*6 + "+" + "-"*10 + "+" + "-"*20 + "+" + "-"*20 + "+\n")

    # Optimization Metrics
    red_pct = ((stats['unopt_count'] - stats['opt_count']) / stats['unopt_count']) * 100 if stats['unopt_count'] > 0 else 0
    print(f"[7] COMPILER OPTIMIZATION & EFFICIENCY AUDIT:")
    print(f"    • Constant Foldings / Algebraic Simplifications : {stats['folds']}")
    print(f"    • Common Subexpression Eliminations (CSE)      : {stats['cse']}")
    print(f"    • Dead Code / Unused Temporaries Removed        : {stats['dce']}")
    print(f"    • Unoptimized Instruction Count                 : {stats['unopt_count']}")
    print(f"    • Optimized Instruction Count                   : {stats['opt_count']}")
    print(f"    • Instruction Reduction Ratio                   : {red_pct:.1f}%")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
