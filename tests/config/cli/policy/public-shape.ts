/** Superseded public spellings fail at the authored document boundary. */
export const POLICY_PUBLIC_REFUSALS = [
    { source: 'run_with = "mise"\n', key: 'run_with' },
    { source: 'tests = ["qa/**"]\n', key: 'tests' },
    { source: '[[scope]]\npath = "api"\n', key: 'scope' },
    {
        source: '[[check]]\nname = "local"\ncommand = ["bun", "check.ts"]\npaths = ["**/*.ts"]\nstage = "commit"\n',
        key: 'check',
    },
];

/** Authored path origins remain independent of the scope that consumes them. */
export const PATH_SCOPE_CASES = [
    { path: '', functions: 'edge', types: 'root.ts', messages: 'messages' },
    { path: 'app', functions: 'app/functions', types: 'app/database.ts', messages: 'app/translations' },
    { path: 'worker', functions: 'edge', types: 'root.ts', messages: 'messages' },
    { path: 'disabled', functions: 'edge', types: '', messages: 'messages' },
];

export const PATH_ORIGINS_POLICY = `configurations = ["javascript"]
[secrets]
env_examples = ["root/.env.example"]
[scope.app]
test_files = ["tests/**"]
[scope.app.secrets]
env_examples = ["examples/.env"]
[scope.app.tools.eslint.runtimes]
"!private/**" = "browser"
[scope.app.architecture.roles]
types = ["core", "types/**"]
test_harness = "harness"
[[scope.app.architecture.modules]]
name = "core"
paths = ["core/**"]
[[scope.app.format.overrides]]
paths = ["src/**", "!src/generated/**"]
indent_width = 2
[scope."app/worker"]
`;

export const NATIVE_PATH_POLICY = `configurations = ["supabase", "i18n"]
[supabase]
types_file = "root.ts"
functions_folder = "edge"
[i18n]
messages_folder = "messages"
[scope.app.supabase]
types_file = "database.ts"
functions_folder = "functions"
[scope.app.i18n]
messages_folder = "translations"
[scope.worker]
[scope.disabled.supabase]
types_file = ""
`;

export const EFFECTIVE_ARCHITECTURE_POLICY = `configurations = ["javascript"]
test_files = ["qa/**"]
[[architecture.modules]]
name = "client"
paths = ["client/**"]
[[architecture.modules]]
name = "storage"
paths = ["storage/**"]
[scope.app]
test_files = ["tests/**"]
[scope.app.architecture.roles]
types = ["models/**"]
[scope."app/child"]
[[scope.replaced.architecture.modules]]
name = "replacement"
paths = ["src/**"]
[scope.worker]
removed_configurations = ["javascript"]
`;
