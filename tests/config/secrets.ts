const READER_FILES = {
    'config/example.env': 'export KNOWN=example\n# ignored\n',
    'source.ts': `Bun.env.KNOWN; Bun.env.MISSING; process.env["MISSING"];
config.$env("CUSTOM");
$readEnv("DOLLAR");
otherconfig.$env("UNDECLARED"); process.env.MISSING;
`,
    'reader.py': `read_env("PYTHON"); read_env("PYTHON"); os.environ["MISSING"]; os.getenv("OTHER");
os.environ.get("OTHER");
`,
    'notes.txt': 'Bun.env.TEXT; $readEnv("TEXT");\n',
} as const;

const NESTED_ENV_FILES = {
    'app/.env.example': 'KNOWN=example\n',
    'app/source.ts': 'process.env.KNOWN; process.env.MISSING;\n',
} as const;

const READER_TABLES = `[secrets]
env_examples = ["example.env"]
reader_functions = ["config.$env", "$readEnv", "read_env"]
`;

const READER_EXAMPLE = `KNOWN=example
MISSING=example
CUSTOM=example
DOLLAR=example
PYTHON=example
OTHER=example
`;

const READER_FINDINGS = [
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'MISSING is read here and appears in no example environment file.',
    },
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'OTHER is read here and appears in no example environment file.',
    },
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'PYTHON is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 1,
        rule: 'missing-key',
        message: 'MISSING is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 2,
        rule: 'missing-key',
        message: 'CUSTOM is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 3,
        rule: 'missing-key',
        message: 'DOLLAR is read here and appears in no example environment file.',
    },
] as const;

const SCOPE_READER_FILES = {
    '.env.example': 'APP_MISSING=example\n',
    'source.ts': 'root_env("ROOT_MISSING");\n',
    'app/project.env': 'APP_KEY=example\nSIBLING_MISSING=example\n',
    'app/source.ts': 'config.$env("APP_KEY"); $readEnv("APP_MISSING");\n',
    'sibling/.env.example': 'KNOWN=example\n',
    'sibling/source.ts': 'Bun.env.SIBLING_MISSING;\n',
} as const;

const SCOPE_READER_TABLES = `[secrets]
reader_functions = ["root_env"]
[[scope]]
path = "app"

[scope.secrets]
env_examples = ["project.env"]
reader_functions = ["config.$env", "$readEnv"]
[[scope]]
path = "sibling"

[scope.secrets]
env_examples = [".env.example"]
`;

const SCOPE_READER_FIXES = {
    '.env.example': 'APP_MISSING=example\nROOT_MISSING=example\n',
    'app/project.env': `APP_KEY=example
SIBLING_MISSING=example
APP_MISSING=example
`,
    'sibling/.env.example': 'KNOWN=example\nSIBLING_MISSING=example\n',
} as const;

const ENV_SOURCE = 'const host = process.env.HOST;\nconsole.log(host, process.env.PORT);\n';

const ENV_EXAMPLES_SANDBOX = {
    configurations: ['secrets'],

    tools: ['dotenv-linter'],
    files: { '.env.example': 'PORT=3000\n' },
} as const;

const ENV_EXAMPLES_CASES = [
    {
        check: 'secrets/dotenv-linter',
        files: {
            '.env.example': `PORT=3000
port=3000
PORT=4000
`,
        },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
        corrected: { files: { '.env.example': 'PORT=3000\n' } },
    },
    {
        check: 'secrets/env-examples',
        files: { '.env.example': 'PORT=3000\n', 'src/server.js': ENV_SOURCE },
        expected: { file: 'src/server.js', line: 1, rule: 'missing-key' },
        corrected: { files: { '.env.example': 'PORT=3000\nHOST=localhost\n', 'src/server.js': ENV_SOURCE } },
    },
] as const;

/** An inert high-entropy API token exercises redacted generic-key reports. */
const API_TOKEN = 'n3K5p7R9' + 't2V4w6Y8' + 'z1A3c5E7' + 'g9I2m4O6';

// Build the scanner sample from halves so repository scans do not read a credential here.
const AWS_KEY_ID = 'AKIA' + 'IOSFODNN7' + 'EXAMPLA';

/** A settings file containing the test credential. */
const AWS_CREDENTIALS = `aws_access_key_id = "${AWS_KEY_ID}"\n`;

const SECRET_FILES = {
    'credential,é.py': `api_key = "${API_TOKEN}"\n`,
    'identity.py': AWS_CREDENTIALS,
} as const;

const FIXED_SECRET_FILES = {
    'credential,é.py': 'import os\napi_key = os.environ["API_KEY"]\n',
    'identity.py': 'import os\naws_access_key_id = os.environ["AWS_ACCESS_KEY_ID"]\n',
} as const;

const GITLEAKS_SCOPES = [
    ['root', ''],
    ['child', 'app/'],
] as const;

/** Inert tokens recognized only by the loopback provider's custom detector. */
const VERIFIER_TOKENS = {
    first: 'gspot-acceptance-token-first',
    second: 'gspot-acceptance-token-second',
} as const;

const TRUFFLEHOG_DETECTORS = {
    detectors: [
        {
            name: 'GspotAcceptance',
            keywords: ['gspot-acceptance-token-'],
            regex: { token: '(gspot-acceptance-token-[a-z]+)' },
        },
    ],
} as const;

const ENV_ACCESSOR_FILES = {
    'app.astro': `---
const endpoint = import.meta.env.VITE_API;
---
<main>{endpoint}</main>
`,
    'app.svelte': '<script>const endpoint = import.meta.env["SVELTE_API"];</script>\n<main>{endpoint}</main>\n',
    'app.vue': `<script setup>const endpoint = import.meta.env.VUE_API;</script>
<template>{{ endpoint }}</template>
`,
    'worker.ts': 'const endpoint = Deno.env.get("DENO_API");\nDeno.env.get("DENO_API");\n',
    'module.mts': 'export const endpoint = import.meta.env.MODULE_API;\n',
    'common.cts': 'export const endpoint = process.env.COMMON_API;\n',
    'legacy.cjs': 'exports.endpoint = process.env.LEGACY_API;\n',
    'notes.txt': 'import.meta.env.UNREAD_API; Deno.env.get("UNREAD_API");\n',
} as const;

const ENV_ACCESSOR_EXAMPLE = `KNOWN=example
VITE_API=example
SVELTE_API=example
VUE_API=example
DENO_API=example
MODULE_API=example
COMMON_API=example
LEGACY_API=example
`;

export {
    API_TOKEN,
    AWS_KEY_ID,
    READER_FILES,
    SECRET_FILES,
    READER_TABLES,
    READER_EXAMPLE,
    READER_FINDINGS,
    GITLEAKS_SCOPES,
    VERIFIER_TOKENS,
    NESTED_ENV_FILES,
    SCOPE_READER_FILES,
    SCOPE_READER_FIXES,
    ENV_EXAMPLES_CASES,
    FIXED_SECRET_FILES,
    ENV_ACCESSOR_FILES,
    SCOPE_READER_TABLES,
    ENV_EXAMPLES_SANDBOX,
    TRUFFLEHOG_DETECTORS,
    ENV_ACCESSOR_EXAMPLE,
};
