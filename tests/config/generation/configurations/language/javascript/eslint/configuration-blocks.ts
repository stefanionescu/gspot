import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';
import { REACT_NATIVE_DEPENDENCIES } from '#tests/config/generation/samples.ts';

export const COMPONENT_FILES = {
    'Card.vue': '<template><p>{{ count }}</p></template>\n<script setup lang="ts">const count: number = 1;</script>\n',
    'Card.svelte': '<script lang="ts">const count: number = 1;</script>\n<p>{count}</p>\n',
    'Card.astro': '---\nconst count: number = 1;\n---\n<p>{count}</p>\n',
    'source.ts': 'export const count: number = 1;\n',
    'source.js': 'export const count = 1;\n',
} as const;

export const HTML_INJECTION_CASES = [
    {
        configuration: 'react',
        path: 'src/Greeting.jsx',
        rule: '@eslint-react/dom-no-dangerously-set-innerhtml',
        sample: 'export const Greeting = () => <div dangerouslySetInnerHTML={{ __html: "<b>Hello</b>" }} />;\n',
        corrected: 'export const Greeting = () => <div>{"<b>Hello</b>"}</div>;\n',
    },
    {
        configuration: 'svelte',
        path: 'src/Greeting.svelte',
        rule: 'svelte/no-at-html-tags',
        sample: '<div>{@html "<b>Hello</b>"}</div>\n',
        corrected: '<div>{"<b>Hello</b>"}</div>\n',
    },
    {
        configuration: 'vue',
        path: 'src/Greeting.vue',
        rule: 'vue/no-v-html',
        sample: '<template><div v-html="markup"></div></template>\n',
        corrected: '<template><div>{{ markup }}</div></template>\n',
    },
    {
        configuration: 'astro',
        path: 'src/Greeting.astro',
        rule: 'astro/no-set-html-directive',
        sample: '<div set:html={"<b>Hello</b>"} />\n',
        corrected: '<div>{"<b>Hello</b>"}</div>\n',
    },
] as const;

const MOBILE_SETTINGS = `configurations = [ "javascript" ]

[[scope]]
path = "bare"
configurations = [ "react-native" ]

[[scope]]
path = "expo-app"
configurations = [ "expo" ]

[rules]
enabled = false
`;

const MOBILE_SOURCE_FILES = {
    'gspot.toml': MOBILE_SETTINGS,
    'bare/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
    'expo-app/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
} as const;

export const MOBILE_FILES: Record<string, string> = {
    ...MOBILE_SOURCE_FILES,
    'bare/package.json': JSON.stringify({
        private: true,
        dependencies: { react: SANDBOX_PACKAGES.react, ...REACT_NATIVE_DEPENDENCIES },
    }),
    'expo-app/package.json': JSON.stringify({
        private: true,
        dependencies: { react: SANDBOX_PACKAGES.react, ...REACT_NATIVE_DEPENDENCIES, expo: '54.0.0' },
    }),
};

export const NEXTJS_ROUTE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'apps/first/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
    'apps/first/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
    'apps/second/src/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
    'apps/second/src/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
    'apps/empty/component.jsx': 'export function Empty() { return <p>Empty</p>; }\n',
};

export const EXPRESS_SOURCE =
    'import value from "#lib/owner";\nresponse.json({ message: `Item ${identifier}` });\ncustom.info(`Item ${identifier}`);\n';

export const EXPRESS_FINDINGS = {
    basic: [
        { file: 'api/child/source.js', rule: 'no-restricted-syntax', line: 1 },
        { file: 'api/child/source.js', rule: 'no-restricted-syntax', line: 2 },
        { file: 'api/source.js', rule: 'no-restricted-syntax', line: 1 },
        { file: 'api/source.js', rule: 'no-restricted-syntax', line: 2 },
        { file: 'source.js', rule: 'no-restricted-syntax', line: 1 },
    ],
    all: [
        { file: 'api/child/source.js', rule: 'no-restricted-syntax', line: 1 },
        { file: 'api/child/source.js', rule: 'no-restricted-syntax', line: 2 },
        { file: 'api/child/source.js', rule: 'no-restricted-syntax', line: 3 },
        { file: 'api/source.js', rule: 'no-restricted-syntax', line: 1 },
        { file: 'api/source.js', rule: 'no-restricted-syntax', line: 2 },
        { file: 'api/source.js', rule: 'no-restricted-syntax', line: 3 },
        { file: 'source.js', rule: 'no-restricted-syntax', line: 1 },
        { file: 'source.js', rule: 'no-restricted-syntax', line: 3 },
    ],
} as const;

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
import { createStore } from "zustand/vanilla";
export const widget = create(() => ({ readFile, value: createStore(() => ({})) }));
`,
    'src/store.js': `import { create } from "zustand";
import { readFile } from "node:fs";
import { createStore } from "zustand/vanilla";
export const store = create(() => ({ readFile, value: createStore(() => ({})) }));
`,
} as const;

export const UNCHECKED_ROUTER_FILES: string[] = [
    'routers/default.ts',
    'inherited/routers/action.ts',
    'outside/action.ts',
    'child/custom/action.ts',
    'inherited/custom/action.ts',
    'plain/routers/action.ts',
];

export const DRIZZLE_SCOPE_SETTINGS = {
    level: 'all',
    rules: true,
    scopes: [{ path: 'app', configurations: ['drizzle'] }],
    tables: '[scope.drizzle]\nclient_names = ["connection"]\n',
} as const;

export const MATCHING_SCOPE_FILES = {
    'package.json': '{"private":true,"type":"module"}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src","same","different"]}',
    'src/root.ts': 'export const root = 1;\n',
    'same/src/sample.ts': 'export const same = 1;\n',
    'same/deep/src/sample.ts': 'export const deep = 1;\n',
    'same/sample.test.ts': 'export const testValue = 1;\n',
    'different/src/sample.ts': 'export const different = 1;\n',
    'different/custom/sample.ts': 'export const custom = 1;\n',
} as const;

export const MATCHING_SCOPE_SETTINGS = `[[scope]]
path = "same"
configurations = []
[[scope]]
path = "same/deep"
configurations = []
[[scope]]
path = "different"
configurations = []
test_files = ["different/custom/**"]
`;

export const TESTING_LIBRARY_CASES = [['react', '@testing-library/react']] as const;

export const ASSERTION_RULE_OWNERS = [
    { name: 'no test framework', configuration: undefined, assertions: 2 },
    { name: 'jest', configuration: 'jest', assertions: 0 },
] as const;

const PORT_SOURCE =
    '// The port the service listens on.\n\n/** The port, read once. */\nexport const port = Number("8080") as number;\n';

export const TYPE_EXPORT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["index.ts","value.ts"]}\n',
    'value.ts': 'export type Shape = { name: string };\nexport const value: Shape = { name: "example" };\n',
    'index.ts':
        'import { value, Shape } from "./value.js";\nexport { value };\nexport { Shape } from "./value.js";\nexport const shape: Shape = value;\n',
} as const;

export const TYPED_RULE_PROJECTS = [
    {
        name: 'a root TypeScript project',
        configurations: ['typescript'],
        tables: '',
        files: {
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}\n',
            'source.ts': PORT_SOURCE,
        },
        file: 'source.ts',
    },
    {
        name: 'a TypeScript scope under a root without TypeScript',
        configurations: [],
        tables: '[[scope]]\npath = "api"\nconfigurations = [ "typescript" ]\n',
        files: {
            'package.json': '{"name":"example","private":true,"type":"module","workspaces":["api"]}\n',
            'api/package.json': '{"name":"api","private":true,"type":"module"}\n',
            'api/tsconfig.json': JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] }) + '\n',
            'api/src/port.ts': PORT_SOURCE,
        },
        file: 'api/src/port.ts',
    },
] as const;
