import { test, expect, beforeAll } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import type { Level } from '#cli/types/configurations.ts';
import { DRIZZLE_DRIVERS } from '#tests/config/cli/generation/guides.ts';
import { RUNTIME_EVIDENCE_CASES } from '#tests/config/cli/repository/manifests.ts';

async function generatedGuides(level: Level, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'], {
            level: level,
        }),
        ...files,
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    return new Map(output.files.filter((file) => file.kind === 'rules').map((file) => [file.path, file.content]));
}

let recommended: ReadonlyMap<string, string>;
let all: ReadonlyMap<string, string>;

beforeAll(async () => {
    recommended = await generatedGuides('recommended', {});
    all = await generatedGuides('all', {});
});

test('recommended guides omit sections marked for level all', () => {
    const path = '.gspot/rules/general/engineering/code/COMMENTS.md';
    expect(recommended.get(path)).not.toContain('## When to comment');
    expect(all.get(path)).toContain('## When to comment');
});

test('a rule whose every section is for level all installs only at all', () => {
    for (const path of [
        'general/engineering/code/NAMING.md',
        'language/typescript/NAMING.md',
        'language/bash/NAMING.md',
    ]) {
        expect(recommended.has(`.gspot/rules/${path}`)).toBe(false);
        expect(all.has(`.gspot/rules/${path}`)).toBe(true);
    }
    expect(recommended.has('.gspot/rules/general/engineering/agent/WORKING.md')).toBe(true);
});

test('conditional guides follow file and dependency evidence', async () => {
    const present = await generatedGuides('all', {
        'bunfig.toml': '[test]\nroot = "tests"\n',
        'package.json': '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
    });
    for (const path of ['language/javascript/BUN.md', 'language/css/TAILWIND.md', 'tool/vitest/PLAYWRIGHT.md']) {
        expect(all.has(`.gspot/rules/${path}`)).toBe(false);
        expect(present.has(`.gspot/rules/${path}`)).toBe(true);
    }
});

test('Swift guides require parsed imports and ignore comments and strings', async () => {
    const absent = await generatedGuides('all', { 'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n' });
    const present = await generatedGuides('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
    for (const path of ['language/swift/SWIFTUI.md', 'language/swift/UIKIT.md']) {
        expect(absent.has(`.gspot/rules/${path}`)).toBe(false);
        expect(present.has(`.gspot/rules/${path}`)).toBe(true);
    }
});

test.each(RUNTIME_EVIDENCE_CASES)('Node instructions follow $name evidence', async (entry) => {
    const guides = await generatedGuides('all', {
        'package.json': JSON.stringify(entry.package),
        'entry.js': entry.source,
        '.gspot/package.json': JSON.stringify('privatePackage' in entry ? entry.privatePackage : {}),
    });
    expect(guides.has('.gspot/rules/language/javascript/NODE.md')).toBe(entry.runtime === 'node' && entry.detected);
});

test.each([...DRIZZLE_DRIVERS])(
    'Drizzle PostgreSQL instructions follow the $driver driver',
    async ({ driver, postgres }) => {
        const guides = await generatedGuides('all', {
            'package.json': JSON.stringify({ dependencies: { 'drizzle-orm': '0.45.1', [driver]: '1.0.0' } }),
        });
        expect(guides.has('.gspot/rules/library/drizzle/DRIZZLE.md')).toBe(postgres);
    },
);

test('shared HTTP and OpenAPI instructions use their engineering and tool owners', async () => {
    const guides = await generatedGuides('all', { 'openapi.yaml': 'openapi: 3.1.0\n' });
    expect(guides.has('.gspot/rules/general/engineering/code/HTTP.md')).toBe(true);
    expect(guides.has('.gspot/rules/tool/openapi/OPENAPI.md')).toBe(true);
    expect(guides.has('.gspot/rules/framework/express/HTTP.md')).toBe(false);
    expect(guides.has('.gspot/rules/framework/express/OPENAPI.md')).toBe(false);
});
