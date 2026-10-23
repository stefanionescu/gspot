export const TRPC_IMPORTS = [
    { source: 'import { router } from "./private/router.js";', line: 2 },
    { source: 'import {\n router\n} from "./private/router.js";', line: 4 },
    { source: 'export { router } from "./private/router.js";', line: 2 },
    { source: 'const router = require("./private/router.js");', line: 2 },
    { source: 'const router = import("./private/router.js");', line: 2 },
    { source: 'import { router } from "#private/router";', line: 2 },
    { source: 'import { router } from "@private/router";', line: 2 },
    { source: 'import { type router as Router, router } from "./private/router.js";', line: 2 },
    { source: 'import router from "./private/router.js";', line: 2 },
    { source: 'import * as router from "./private/router.js";', line: 2 },
    { source: 'import "./private/router.js";', line: 2 },
    { source: 'export { type router as Router, router } from "./private/router.js";', line: 2 },
    { source: 'export * from "./private/router.js";', line: 2 },
] as const;

export const TRPC_TYPES = `import type { router } from "./private/router.js";
import { type router as Router } from "./private/router.js";
export type { router as RouterExport } from "./private/router.js";
export { type router as SpecifierExport } from "./private/router.js";
export type * from "./private/router.js";
`;

export const TRPC_MODULES = `[trpc]
server_files = ["private/**", "app/api/trpc/**", "app/private/**", "app/child/private/**", "flat/router.ts"]

[[import_rule]]
name = "server"
paths = ["private/**", "app/api/trpc/**", "app/private/**", "app/child/private/**", "flat/router.ts"]
[[import_rule]]
name = "client"
paths = ["client/**"]
[[import_rule]]
name = "storage"
paths = ["storage/**"]
`;

export const TRPC_FAILURES = {
    'form-value.js': 1,
    'client/blocked.ts': 1,
    'client/check.test.ts': 1,
    'app/child/client.ts': 1,
    'flat/client.ts': 1,
} as const;

export const TRPC_FILES = {
    'tsconfig.json':
        '{"compilerOptions":{"allowJs":true,"paths":{"@private/*":["./private/*"]}},"include":["**/*.ts"]}',
    'package.json': '{"name":"routers","private":true,"type":"module","imports":{"#private/*":"./private/*.ts"}}',
    'private/router.ts': 'export const router = {};\n',
    'public/value.ts': 'export const value = 1;\n',
    'public.ts': 'import { value } from "./public/value.js";\n',
    'form-value.js': 'import { router } from "./private/router.js";\n',
    'flat/router.ts': 'export const router = {};\n',
    'flat/client.ts': 'import { router } from "./router.js";\n',
    'comment.ts': '// import { router } from "./private/router.js";\nexport const title = "Public";\n',
    'app/api/trpc/route.ts': 'import { router } from "../../../private/router.js";\nexport const handler = router;\n',
    'client/blocked.ts': 'import { value } from "../storage/value.js";\n',
    'storage/value.ts': 'export const value = 1;\n',
    'client/check.test.ts': 'import { router } from "../private/router.js";\n',
    'client/storage.test.ts': 'import { value } from "../storage/value.js";\n',
    'app/private/router.ts': 'export const router = {};\n',
    'app/client.ts': TRPC_TYPES,
    'app/child/private/router.ts': 'export const router = {};\n',
    'app/child/client.ts': 'import { router } from "./private/router.js";\n',
} as const;

export const ZUSTAND_FILES = {
    'package.json': '{"name":"restricted-imports","private":true,"type":"module","dependencies":{"zustand":"5.0.8"}}',
    'src/widget.js': `import { create } from "zustand";
import { readFile } from "node:fs";
export const widget = create(() => ({ readFile }));
`,
    'src/store.js': `import { create } from "zustand";
import { readFile } from "node:fs";
export const store = create(() => ({ readFile }));
`,
} as const;

export const ZUSTAND_TABLES = `[tools.eslint]
restricted_imports = [{ name = "node:fs", message = "Use the storage service." }]
[zustand]
store_files = ["**/store.js"]
`;

export const TRANSLATION_SOURCE = 'export const element = <p>Hello there</p>;\n';

export const UNCHECKED_ROUTER_FILES: string[] = [
    'outside/action.ts',
    'child/custom/action.ts',
    'inherited/custom/action.ts',
    'plain/routers/action.ts',
];

export const ROUTER_ROLE_FILES: string[] = [
    'custom/action.ts',
    'routers/default.ts',
    'child/handlers/action.ts',
    'inherited/routers/action.ts',
];

export const DRIZZLE_SCOPE_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [{ path: 'app', configurations: ['drizzle'] }],
    tables: '[scope.drizzle]\nclient_names = ["connection"]\n',
} as const;
