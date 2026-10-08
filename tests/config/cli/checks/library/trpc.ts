/** Native import forms retain their line locations and type-only counterparts. */
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
];

export const TRPC_TYPES =
    'import type { router } from "./private/router.js";\nimport { type router as Router } from "./private/router.js";\nexport type { router as RouterExport } from "./private/router.js";\nexport { type router as SpecifierExport } from "./private/router.js";\nexport type * from "./private/router.js";\n';

/** Explicit server modules own router and adapter paths; other authored import policies stay effective. */
export const TRPC_MODULES = `[[architecture.modules]]
name = "server"
paths = ["private/**", "app/api/trpc/**"]
may_import = ["server"]
[[architecture.modules]]
name = "client"
paths = ["client/**"]
may_import = ["server", "client"]
[[architecture.modules]]
name = "storage"
paths = ["storage/**"]
may_import = ["storage"]
`;

export const TRPC_LEVELS: ('recommended' | 'all')[] = ['recommended', 'all'];

export const TRPC_COMMENT = '// import { router } from "./private/router.js";\nexport const title = "Public";\n';

export const TRPC_FAILURES = {
    'form-value.js': 1,
    'client/blocked.ts': 1,
    'client/check.test.ts': 1,
    'app/child/client.ts': 1,
    'flat/client.ts': 1,
};

/** Real sources and project declarations consumed by the generated native rule. */
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
    'comment.ts': TRPC_COMMENT,
    'app/api/trpc/route.ts': 'import { router } from "../../../private/router.js";\nexport const handler = router;\n',
    'client/blocked.ts': 'import { value } from "../storage/value.js";\n',
    'storage/value.ts': 'export const value = 1;\n',
    'client/check.test.ts': 'import { router } from "../private/router.js";\n',
    'client/storage.test.ts': 'import { value } from "../storage/value.js";\n',
    'app/private/router.ts': 'export const router = {};\n',
    'app/client.ts': TRPC_TYPES,
    'app/child/private/router.ts': 'export const router = {};\n',
    'app/child/client.ts': 'import { router } from "./private/router.js";\n',
};
