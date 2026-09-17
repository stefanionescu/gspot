export const DYNAMIC_LANGUAGES = ['bash', 'python', 'swift'] as const

export const GRAMMAR_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.ts': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.tsx': 'Tsx',
  '.js': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.jsx': 'JavaScript',
  '.css': 'Css',
  '.html': 'Html',
  '.htm': 'Html',
  '.py': 'python',
  '.pyi': 'python',
  '.swift': 'swift',
  '.sh': 'bash',
  '.bash': 'bash',
  '.bats': 'bash',
}

export const GRAMMAR_BY_INTERPRETER: Readonly<Record<string, string>> = {
  bash: 'bash',
  sh: 'bash',
  dash: 'bash',
  ksh: 'bash',
  zsh: 'bash',
  python: 'python',
  python3: 'python',
  node: 'JavaScript',
}

export const FUNCTION_KINDS_BY_GRAMMAR: Readonly<Record<string, readonly string[]>> = {
  TypeScript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
  Tsx: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
  JavaScript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
  bash: ['function_definition'],
  python: ['function_definition'],
  swift: ['function_declaration', 'lambda_literal'],
}

export const COUNT_MEASURES = ['per-file', 'per-function', 'nesting', 'nodes'] as const

export const PREFIX_PARTS = 2

export const SOURCE_SEPARATORS = /[-_.]/u

export const SHELL_CALL_PATTERN = /(?<![A-Za-z0-9_])NAME(?![A-Za-z0-9_])/u

export const BROKEN_NODE_KINDS = ['ERROR', 'MISSING']

export const TRIVIAL_BODY_NODES = 4

export const PARSE_FAILURE_CONTEXT = 40

export const RULE_FILE_SUFFIX = '.yml'
