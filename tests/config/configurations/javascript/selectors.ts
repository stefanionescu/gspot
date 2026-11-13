import type { SelectorSample } from '#tests/types/configurations.ts';

const MODULE_PACKAGE = '{"private":true,"type":"module"}\n';

const NEXT_CONFIG_FILES = {
    'tsconfig.json': '{"include":["*.ts"]}\n',
    'settings.ts': 'export const settings = { env: { API_TOKEN: "text" } };\n',
} as const;

export const CONFIGURATION_SELECTOR_SAMPLES: readonly SelectorSample[] = [
    {
        name: 'store, form and procedure selectors report whole-store reads and calls without a schema, and accept schema options and unrelated queries',
        configurations: ['javascript', 'zustand', 'react-hook-form', 'trpc'],
        level: 'basic',
        tables: '[trpc]\nrouter_files = ["source.js", "router.js"]\n',
        files: {
            'source.js':
                "import { useStore } from 'zustand';\nuseStore(cartStore);\nuseForm(options);\nuseForm({ ...options });\nuseForm({ defaultValues: { nested: { resolver: 1 } } });\npublicProcedure.query(resolve);\nprotectedProcedure.use(logger).query(resolve);\nt.procedure.query(resolve);\npool.query(sql);\nbyId.query(resolve);\ngetClient().query(sql);\npublicProcedure.input(schema).use(logger).mutation(resolve);\n",
            'counter.js':
                "import { useStore } from './store.js';\nexport function readCount() {\n    return useStore((state) => state.count);\n}\n",
            'cart.js':
                "import { useStore } from 'zustand';\nimport { cartStore, useCartStore } from './store.js';\nexport function readCart() {\n    const whole = useCartStore();\n    return [whole];\n}\n",
            'router.js':
                'const byId = publicProcedure.input(schema);\nexport const appRouter = router({\n    order: publicProcedure.input(schema).query(({ input }) => pool.query(sql)),\n});\n',
        },
        findings: { 'cart.js': [4], 'source.js': [2, 5, 6, 7, 8] },
    },
    {
        name: 'a module-level store in a store file is reported at level all, and a store in a factory is not',
        configurations: ['javascript', 'zustand'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'cart.store.js':
                "import { createStore } from 'zustand/vanilla';\n\nexport const cartStore = createStore(() => ({}));\n\nexport function buildStore() {\n    return createStore(() => ({}));\n}\n",
        },
        findings: { 'cart.store.js': [3] },
    },
    {
        name: 'a raw sql statement is reported at level all, and a sql fragment inside the query builder is not',
        configurations: ['javascript', 'drizzle'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'source.js':
                'await db.execute(sql`select 1`);\nawait db.update(orders).set({ total: sql`${orders.total} + 1` });\n',
        },
        findings: { 'source.js': [1] },
    },
    {
        name: 'the NestJS selectors report their sample lines at level all',
        configurations: ['typescript', 'nestjs'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'tsconfig.json': '{"compilerOptions":{"experimentalDecorators":true},"include":["*.ts"]}\n',
            'source.ts':
                'import { Res, Response, forwardRef } from "@nestjs/common";\nexport class Controller {\n    first(@Res() response: unknown) { return response; }\n    second(@Response({ passthrough: true }) response: unknown) { return response; }\n}\nforwardRef(() => Controller);\n',
        },
        findings: { 'source.ts': [3, 6] },
    },
    {
        name: 'the React Native selectors report their sample lines at level all',
        configurations: ['javascript', 'react-native'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'source.jsx':
                'import { TouchableOpacity, Pressable } from "react-native";\nAsyncStorage.setItem("accessToken", value);\nAsyncStorage.setItem("theme", value);\nexport const button = <Pressable />;\n',
        },
        findings: { 'source.jsx': [1, 2] },
    },
    {
        name: 'the Express selectors report request data in sinks and accept parameters and JSON',
        configurations: ['express'],
        level: 'basic',
        files: {
            'package.json': '{"private":true,"type":"module","dependencies":{"express":"0.0.0-test"}}\n',
            'json.js': 'res.json({ name: req.query.name });\n',
            'parameterized.js': 'db.query("SELECT * FROM users WHERE id = $1", [req.query.id]);\n',
            'query-template.js': 'db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n',
            'execute-template.js': 'db.execute(`DELETE FROM users WHERE id = ${req.params.id}`);\n',
            'stack.js': 'res.json({ stack: error.stack });\nres.status(500).send({ stack: error.stack });\n',
            'failure.js': 'res.json({ error: "Request failed" });\n',
            'client-message.js': 'res.json({ message: `Item ${identifier}` });\n',
        },
        findings: {
            'client-message.js': [1],
            'execute-template.js': [1],
            'query-template.js': [1],
            'stack.js': [1, 2],
        },
    },
    {
        name: 'the Next.js selectors read next.config: keys after a nested env value',
        configurations: ['nextjs'],
        level: 'basic',
        files: {
            ...NEXT_CONFIG_FILES,
            'next.config.ts': `export default {
  env: {
    NESTED: { API_TOKEN: "nested text" },
    "API_SECRET": process.env.API_SECRET,
    ["PASSWORD"]: process.env.PASSWORD,
    TOKEN,
  },
  typescript: { ["ignoreBuildErrors"]: (true as const) },
};
`,
        },
        findings: { 'next.config.ts': [4, 5, 6, 8] },
    },
    {
        name: 'the Next.js selectors read next.config: quoted and asserted literal disabled checks',
        configurations: ['nextjs'],
        level: 'basic',
        files: {
            ...NEXT_CONFIG_FILES,
            'next.config.ts': `export default {
  eslint: { "ignoreDuringBuilds": true satisfies boolean },
  typescript: { ignoreBuildErrors: <boolean>true },
};
`,
        },
        findings: { 'next.config.ts': [2, 3] },
    },
    {
        name: 'the Next.js selectors read next.config: comments, strings, false flags, and nested env values',
        configurations: ['nextjs'],
        level: 'basic',
        files: {
            ...NEXT_CONFIG_FILES,
            'next.config.ts': `// env: { API_SECRET: "comment" }
const text = "ignoreBuildErrors: true";
export default {
  env: { SETTINGS: { API_TOKEN: text }, PUBLIC_ENDPOINT: "https://example.com" },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: enabled },
};
`,
        },
        findings: {},
    },
    {
        name: 'the Cloudflare and Supabase selectors report wildcard origins and raw filters',
        configurations: ['javascript', 'typescript', 'supabase', 'cloudflare'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'tsconfig.json': '{"include":["supabase"]}\n',
            'wrangler.toml': 'name = "example"\ncompatibility_date = "2026-01-01"\n',
            'supabase/config.toml': 'project_id = "example"\n',
            'functions/headers.js': 'response.headers.set("Access-Control-Allow-Origin", "*");\n',
            'functions/named.js': 'response.headers.set("Access-Control-Allow-Origin", "https://example.com");\n',
            'supabase/functions/_shared/cors.ts': 'export const headers = { "Access-Control-Allow-Origin": "*" };\n',
            'supabase/functions/cors/index.ts':
                'export const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" };\n',
            'src/select.js': 'client.from("users").select(`id,${column}`);\n',
            'src/equal.js': 'client.from("users").filter("name", "eq", `${name}`);\n',
            'src/filter.js': 'client.from("users").or(`id.eq.${input}`);\n',
            'src/list.js': 'client.from("users").filter("id", "in", `(${input})`);\n',
            'src/search.js': 'client.from("docs").textSearch("body", `\'${term}\'`);\n',
            'src/plain.js': 'client.from("docs").textSearch("body", `${term}`, { type: "plain" });\n',
            'src/phrase.js': 'client.from("docs").textSearch("body", `${term}`, { type: "phrase" });\n',
            'src/websearch.js': 'client.from("docs").textSearch("body", `${term}`, { type: "websearch" });\n',
        },
        findings: {
            'functions/headers.js': [1],
            'src/filter.js': [1],
            'src/list.js': [1],
            'src/search.js': [1],
            'supabase/functions/_shared/cors.ts': [1],
            'supabase/functions/cors/index.ts': [1, 1],
        },
    },
];

export const EXPRESS_SCOPE_SETTINGS = `[[scope]]
path = "app"
configurations = ["express"]

[[scope]]
path = "app/child"

[[scope]]
path = "sibling"
`;

export const SUPABASE_FOLDER_SETTINGS = `[[scope]]
path = "api"
configurations = ["supabase"]

[scope.supabase]
functions_folder = "edge"

[[scope]]
path = "sibling"
`;
