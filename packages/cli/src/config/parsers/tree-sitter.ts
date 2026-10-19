export const GRAMMAR_NAMES = ['typescript', 'tsx', 'javascript', 'bash', 'python', 'swift', 'html', 'css'] as const;

export const LANGUAGE_GRAMMARS: Readonly<Record<string, (typeof GRAMMAR_NAMES)[number]>> = {
    bash: 'bash',
    swift: 'swift',
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
};

/** The file extensions that each code grammar reads. Shell scripts without an extension use bash too. */
export const GRAMMAR_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
    javascript: ['.js', '.mjs', '.cjs', '.jsx'],
    typescript: ['.ts', '.mts', '.cts'],
    tsx: ['.tsx'],
    python: ['.py', '.pyi'],
    swift: ['.swift'],
    bash: ['.sh', '.bash', '.zsh', '.bats'],
};

export const GRAMMAR_FILE_EXTENSION = '.wasm';
