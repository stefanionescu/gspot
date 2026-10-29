export const GROUP_CASES = [
    'language',
    'framework',
    'platform',
    'database',
    'testing',
    'infrastructure',
    'library',
    'general',
] as const;

export const LEVEL_CASES = ['basic', 'all'] as const;

export const SWITCH_CASES = [
    { name: 'hooks', path: '.gspot/hooks/pre-commit' },
    { name: 'rules', path: '.gspot/configurations/general/engineering/rules/WORKING.md' },
    { name: 'ci', path: '.github/workflows/gspot.yml' },
] as const;

export const PROJECT_FILES = {
    'package.json': '{"private":true,"type":"module","dependencies":{"next":"1.0.0","react":"1.0.0","zod":"1.0.0"}}',
    'source.js': 'export const value = 1;\n',
    'source.ts': 'export const value: number = 1;\n',
    'source.test.ts': 'test("value", () => expect(1).toBe(1));\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
    'page.astro': '<h1>Title</h1>\n',
    'page.svelte': '<h1>Title</h1>\n',
    'page.vue': '<template><h1>Title</h1></template>\n',
    'page.jsx': 'export const page = <h1>Title</h1>;\n',
    'style.css': 'a { color: red; }\n',
    'index.html': '<!doctype html><title>Example</title>\n',
    'README.md': '# Example\n',
    'source.py': 'value = 1\n',
    'test_source.py': 'def test_value():\n    assert 1 == 1\n',
    'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\n',
    'Source.swift': 'let value = 1\n',
    'query.sql': 'SELECT 1;\n',
    'script.sh': '#!/usr/bin/env bash\necho example\n',
    'data.yaml': 'name: example\n',
    Dockerfile: 'FROM scratch\n',
    'openapi.yaml': 'openapi: 3.1.0\ninfo:\n  title: Example\n  version: 1.0.0\npaths: {}\n',
    'supabase/config.toml': 'project_id = "example"\n',
    'supabase/functions/example/index.ts': 'export const value = 1;\n',
    'wrangler.toml': 'name = "example"\nmain = "source.js"\n',
};
