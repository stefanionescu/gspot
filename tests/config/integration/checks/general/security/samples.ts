import { BASE_INSTALLED_FILES } from '#tests/config/setup/sandboxes.ts';

export const SEMGREP_PROJECT_FILES = {
    'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"express":"0.0.0-test"}}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': `[project]
name = "example"
version = "1.0.0"
dependencies = ["fastapi"]
`,
    'src/index.ts': 'export const answer = 42;\n',
    'script.sh': '#!/usr/bin/env bash\nprintf "%s\\n" "Ready"\n',
    'Value.swift': 'let answer = 42\n',
    'wrangler.toml': 'name = "example"\ncompatibility_date = "2026-01-01"\n',
    'supabase/config.toml': 'project_id = "example"\n',
} as const;

export const SEMGREP_CHECK = ['check', '--only', 'security/semgrep', '--json'] as const;

export const SEMGREP_SANDBOX = {
    configurations: [
        'javascript',
        'typescript',
        'python',
        'bash',
        'swift',
        'security',
        'nextjs',
        'express',
        'fastapi',
        'supabase',
        'cloudflare',
    ],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;
