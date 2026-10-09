/** Native project policy before Expo or React DOM dependencies appear. */
import type { SpawnResult } from '#cli/types/platform/runtime.ts';

export const MOBILE_RECONCILIATION_POLICY = `configurations = ["react-native"]
[agent_rules]
enabled = false
[tools.eslint.rules]
"react-native/no-raw-text" = [{ skip = ["ProjectText"] }]
`;

/** The declared package manager version supplied by the process boundary. */
export const NPM_VERSION = '11.19.0';

/** A successful command with no diagnostic output. */
export const NPM_SUCCESS: SpawnResult = { code: 0, missing: false, duration: 1, stdout: '', stderr: '' };

/** Authored language choices whose automatic and inherited closure needs no repeated entries. */
export const INHERITED_SELECTION_FILES = {
    'source.ts': 'export const port = 8080;\n',
    'app/package.json': '{"name":"app","private":true}\n',
    'app/source.js': 'export const port = 3000;\n',
    'app/source.py': 'PORT = 3000\n',
};

/** A child keeps its explicit Python choice even though the root selects it. */
export const INHERITED_SELECTION_TABLE = '[scope.app]\nconfigurations = ["python"]\n';

/** A newly detected stack belongs to the outer project and is inherited by its child. */
export const NESTED_SELECTION_FILES = {
    'app/package.json': '{"private":true,"dependencies":{"react":"19.1.1"}}\n',
    'app/App.jsx': 'export const App = () => <div />;\n',
    'app/child/package.json': '{"private":true}\n',
    'app/child/source.js': 'export const port = 3000;\n',
};

/** A root detects TypeScript and JavaScript together, with JavaScript already required by TypeScript. */
export const REQUIRED_SELECTION_FILES = {
    'source.ts': 'export const port = 8080;\n',
    'source.js': 'export const port = 3000;\n',
};
