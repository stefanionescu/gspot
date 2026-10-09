/** Cached sandboxes keep their source and scopes independent. */
export const PROJECT_FILES = {
    'package.json':
        '{"name":"shared-native-tools","private":true,"description":"The native cache sample.","type":"module"}\n',
    'source.js': '// Run the stopped app.\n\ndebugger;\n',
    'app/source.js': '// Run the stopped child app.\n\ndebugger;\n',
    '.venv/authored.txt': 'The authored project environment.\n',
    'README.md': '# Native Tools\n\nRun the app.\n',
};

export const SCOPE = '[scope."app"]\nconfigurations = ["javascript", "prose"]\n';

/** Both states execute the selected scoped JavaScript and prose checks. */
export const CHECKS = ['check', '--only', 'javascript/eslint', 'prose/vale', '--json'];

export const CORRECTED = '// Store the app result.\n\n/** The app result. */\nexport const appResult = 1;\n';

/** The independent selected Stylelint variant rejects the invalid color. */
export const INVALID_CSS = '/* The sample card. */\n.card {\n    color: #ggg;\n}\n';
export const CLEAN_CSS = '/* The sample card. */\n.card {\n    color: #abc;\n}\n';
