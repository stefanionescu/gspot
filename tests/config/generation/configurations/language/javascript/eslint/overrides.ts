const RESTRICTED_IMPORT_SOURCE = `import { readFile } from 'node:fs';
import { join } from 'node:path';
export const files = [readFile, join];
`;

const RESTRICTED_ZUSTAND_SOURCE = `import { readFile } from 'node:fs';
import { join } from 'node:path';
import { create } from 'zustand';
export const store = create(() => ({ readFile, join }));
`;

export const ESLINT_OVERRIDES_SETTINGS = `configurations = [ "javascript" ]

[rules]
enabled = false

[tools.eslint.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "tests" ]

[tools.eslint.override.rules]
eqeqeq = [ "always" ]

[[tools.eslint.override]]
paths = [ "tests/exempt.js" ]

[tools.eslint.override.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "apps/web/**", "!apps/web/exempt.js" ]

[tools.eslint.override.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "apps/web/admin/**" ]

[tools.eslint.override.rules]
eqeqeq = [ "always" ]

[[scope]]
path = "apps/web"

[scope.tools.eslint.rules]
eqeqeq = [ "always" ]

[[scope]]
path = "apps/web/admin"
`;

export const SCOPE_IMPORT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'source.js': RESTRICTED_IMPORT_SOURCE,
    'sibling/source.js': RESTRICTED_IMPORT_SOURCE,
    'app/source.js': RESTRICTED_IMPORT_SOURCE,
    'app/deep/source.js': RESTRICTED_IMPORT_SOURCE,
    'app/clear/source.js': RESTRICTED_IMPORT_SOURCE,
    'state/widget.js': RESTRICTED_ZUSTAND_SOURCE,
    'state/store.js': RESTRICTED_ZUSTAND_SOURCE,
} as const;

export const SCOPE_IMPORT_TABLES = `[tools.eslint]
restricted_imports = [{ name = "node:path", message = "Use the path service." }]

[[scope]]
path = "app"
[scope.tools.eslint]
restricted_imports = [{ name = "node:fs", message = "Use the storage service." }]

[[scope]]
path = "app/deep"

[[scope]]
path = "app/clear"
[scope.tools.eslint]
restricted_imports = []

[[scope]]
path = "state"
configurations = ["zustand"]
[scope.tools.eslint]
restricted_imports = [{ name = "node:fs", message = "Use the storage service." }]
[scope.zustand]
store_files = ["state/store.js"]
`;

export const RESTRICTED_IMPORT_FINDINGS = [
    { file: 'app/deep/source.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'sibling/source.js', rule: 'no-restricted-imports', line: 2 },
    { file: 'source.js', rule: 'no-restricted-imports', line: 2 },
    { file: 'state/store.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'state/widget.js', rule: 'no-restricted-imports', line: 1 },
    { file: 'state/widget.js', rule: 'no-restricted-imports', line: 3 },
] as const;

export const RESTRICTED_IMPORT_SETTINGS = {
    tables: `[[tools.eslint.restricted_imports]]
name = "lodash"
message = "Use the built-in methods."

[[tools.eslint.override]]
paths = ["app/**"]
rules = { "no-restricted-imports" = [{ paths = [{ name = "moment", message = "Use Temporal." }] }] }
`,
} as const;
