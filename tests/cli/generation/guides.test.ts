import { test, expect, beforeAll } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { Level } from '#cli/types/configurations.ts';
import { RULES_DIRECTORY } from '#cli/config/platform/locations.ts';
import { runtimeEvidenceCases } from '#tests/harness/repository.ts';
import { DRIZZLE_DRIVERS, PLAYWRIGHT_RUNNERS, PLAYWRIGHT_DEPENDENCIES } from '#tests/config/cli/generation/guides.ts';

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
    const path = `${RULES_DIRECTORY}/general/engineering/code/COMMENTS.md`;
    expect(recommended.get(path)).not.toContain('## When to comment');
    expect(all.get(path)).toContain('## When to comment');
});

test('a rule whose every section is for level all installs only at all', () => {
    for (const path of ['general/naming/NAMING.md', 'language/typescript/NAMING.md', 'language/bash/NAMING.md']) {
        expect(recommended.has(`${RULES_DIRECTORY}/${path}`)).toBe(false);
        expect(all.has(`${RULES_DIRECTORY}/${path}`)).toBe(true);
    }
    expect(recommended.has(`${RULES_DIRECTORY}/general/engineering/agent/WORKING.md`)).toBe(true);
});

test('conditional guides follow file and dependency evidence', async () => {
    const present = await generatedGuides('all', {
        'bunfig.toml': '[test]\nroot = "tests"\n',
        'package.json': '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
    });
    for (const path of [
        'language/javascript/BUN.md',
        'language/css/TAILWIND.md',
        'language/javascript/PLAYWRIGHT.md',
    ]) {
        expect(all.has(`${RULES_DIRECTORY}/${path}`)).toBe(false);
        expect(present.has(`${RULES_DIRECTORY}/${path}`)).toBe(true);
    }
});

test('Swift guides require parsed imports and ignore comments and strings', async () => {
    const absent = await generatedGuides('all', { 'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n' });
    const present = await generatedGuides('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
    for (const path of ['language/swift/SWIFTUI.md', 'language/swift/UIKIT.md']) {
        expect(absent.has(`${RULES_DIRECTORY}/${path}`)).toBe(false);
        expect(present.has(`${RULES_DIRECTORY}/${path}`)).toBe(true);
    }
});

test.each(runtimeEvidenceCases())('Node instructions follow $name evidence', async (entry) => {
    const guides = await generatedGuides('all', {
        'package.json': JSON.stringify(entry.package),
        'entry.js': entry.source,
        '.gspot/package.json': JSON.stringify('toolProjectManifest' in entry ? entry.toolProjectManifest : {}),
    });
    expect(guides.has(`${RULES_DIRECTORY}/language/javascript/NODE.md`)).toBe(
        entry.runtime === 'node' && entry.detected,
    );
});

test.each([...DRIZZLE_DRIVERS])(
    'Drizzle PostgreSQL instructions follow the $driver driver',
    async ({ driver, postgres }) => {
        const guides = await generatedGuides('all', {
            'package.json': JSON.stringify({ dependencies: { 'drizzle-orm': '0.45.1', [driver]: '1.0.0' } }),
        });
        expect(guides.has(`${RULES_DIRECTORY}/library/drizzle/DRIZZLE.md`)).toBe(postgres);
    },
);

test('shared HTTP and OpenAPI instructions use their engineering and tool owners', async () => {
    const guides = await generatedGuides('all', { 'openapi.yaml': 'openapi: 3.1.0\n' });
    expect(guides.has(`${RULES_DIRECTORY}/general/engineering/code/HTTP.md`)).toBe(true);
    expect(guides.has(`${RULES_DIRECTORY}/infra/openapi/OPENAPI.md`)).toBe(true);
    expect(guides.has(`${RULES_DIRECTORY}/framework/express/HTTP.md`)).toBe(false);
    expect(guides.has(`${RULES_DIRECTORY}/framework/express/OPENAPI.md`)).toBe(false);
});

const projects = (['recommended', 'all'] as const).flatMap((level) =>
    ['', 'app'].map((scope) => ({ level, scope, project: scope || 'root' })),
);

test.each(
    projects.flatMap((project) =>
        PLAYWRIGHT_RUNNERS.flatMap((runner) =>
            PLAYWRIGHT_DEPENDENCIES.map((dependency) => ({ ...project, ...runner, ...dependency })),
        ),
    ),
)('Playwright guidance follows $dependency with $runner at $level in $project', async (entry) => {
    await using sandbox = await testdir();
    const prefix = entry.scope === '' ? '' : `${entry.scope}/`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(entry.scope === '' ? [...entry.configurations] : [], {
            level: entry.level,
            tables: entry.scope === '' ? '' : `[scope.app]\nconfigurations = ${JSON.stringify(entry.configurations)}\n`,
        }),
        [`${prefix}package.json`]: JSON.stringify({ dependencies: { [entry.dependency]: '1.0.0' } }),
        ...(entry.runner === 'Bun' ? { [`${prefix}bunfig.toml`]: '[test]\nroot = "tests"\n' } : {}),
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const paths = output.files.filter((file) => file.kind === 'rules').map((file) => file.path);
    expect(paths.filter((path) => path === `${RULES_DIRECTORY}/language/javascript/PLAYWRIGHT.md`)).toHaveLength(
        entry.present ? 1 : 0,
    );
    expect(paths).not.toContain(`${RULES_DIRECTORY}/test/vitest/PLAYWRIGHT.md`);
    expect(paths).toContain(`${RULES_DIRECTORY}/general/engineering/agent/TALKING.md`);
});
