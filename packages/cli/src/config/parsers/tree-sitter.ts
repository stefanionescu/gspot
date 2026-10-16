export const GRAMMAR_NAMES = ['typescript', 'tsx', 'javascript', 'bash', 'python', 'swift', 'html', 'css'] as const;

export const LANGUAGE_GRAMMARS: Readonly<Record<string, (typeof GRAMMAR_NAMES)[number]>> = {
    bash: 'bash',
    swift: 'swift',
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
};
export const TSX_EXTENSION = '.tsx';

export const GRAMMAR_FILE_EXTENSION = '.wasm';
