/** Root and scope selections without source files for detection. */
export const SAVED_CHOICES = `configurations = ["css", "react"]\n[rules]\nenabled = false\n[[scope]]\npath = "api"\n\nconfigurations = ["python"]\n`;

/** An authored shell scope without an earlier private selection history. */
export const SAVED_SCOPE_CHOICE = `configurations = []\n[rules]\nenabled = false\n[[scope]]\npath = "api"\n\nconfigurations = ["bash"]\n`;

export const REACT_NATIVE_SETTINGS = `configurations = ["react-native"]
[rules]
enabled = false
[tools.eslint.rules]
"react-native/no-raw-text" = [{ skip = ["ProjectText"] }]
`;

/** Authored language choices whose automatic and inherited closure needs no repeated entries. */
export const INHERITED_SELECTION_FILES = {
    'source.ts': 'export const port = 8080;\n',
    'app/package.json': '{"name":"app","private":true}\n',
    'app/source.js': 'export const port = 3000;\n',
    'app/source.py': 'PORT = 3000\n',
} as const;

/** A child inherits the stack detected in its outer project. */
export const NESTED_SELECTION_FILES = {
    'app/package.json': '{"private":true,"dependencies":{"react":"19.1.1"}}\n',
    'app/App.jsx': 'export const App = () => <div />;\n',
    'app/child/package.json': '{"private":true}\n',
    'app/child/source.js': 'export const port = 3000;\n',
} as const;

/** A root detects TypeScript and JavaScript together, with JavaScript already required by TypeScript. */
export const REQUIRED_SELECTION_FILES = {
    'source.ts': 'export const port = 8080;\n',
    'source.js': 'export const port = 3000;\n',
} as const;

export const SEMGREP_ASSETS = [
    'configurations/language/example/semgrep/first.yml',
    'configurations/language/example/semgrep/second.yml',
    'configurations/language/example/semgrep/not-a-pack.txt',
] as const;

export const CONFIGURATION_TABLE = `
[configuration]
title = "Local"
description = "A local configuration used by manifest loading."
`;

export const ALWAYS_SELECTED = [
    'commits',
    'dependencies',
    'docs',
    'duplication',
    'engineering',
    'files',
    'format',
    'gspot',
    'naming',
    'prose',
    'repository',
    'secrets',
    'security',
    'spelling',
    'structure',
] as const;
