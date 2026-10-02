import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { parseManifest } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';

async function generatedGuides(level: string, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['typescript', 'css', 'vitest', 'swift', 'html', 'python', 'bash', 'express', 'nestjs', 'svelte'],
            '',
            level,
        ),
        ...files,
    });
    const session = await openSession(sandbox.path);
    const plan = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    return new Map(plan.files.filter((file) => file.kind === 'rules').map((file) => [file.path, file.content]));
}

test('recommended guides omit marked sections and retain the next heading', async () => {
    const recommended = await generatedGuides('recommended', {});
    const all = await generatedGuides('all', {});
    const path = '.gspot/guides/language/TYPESCRIPT.md';
    expect(recommended.get(path)).not.toContain('## Declaration order');
    expect(all.get(path)).toContain('## Declaration order');
    expect(recommended.get(path)).toContain('## Rules not adopted');
});

test('conditional guides follow lockfile and dependency evidence', async () => {
    const absent = await generatedGuides('all', {});
    const present = await generatedGuides('all', {
        'bunfig.toml': '[test]\nroot = "tests"\n',
        'package.json': '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
    });
    for (const path of ['runtime/bun/BUN.md', 'tool/tailwind/TAILWIND.md', 'tool/playwright/PLAYWRIGHT.md']) {
        expect(absent.has(`.gspot/guides/${path}`)).toBe(false);
        expect(present.has(`.gspot/guides/${path}`)).toBe(true);
    }
});

test('a selected manifest cannot silently omit a missing guide asset', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([]) });
    const session = await openSession(sandbox.path);
    const manifest = parseManifest(
        '[kit]\nname = "example"\nkind = "general"\ntitle = "Example"\ndescription = "Example guide selection for this test."\n[guides]\ncode = [{path = "missing.md"}]\n',
        'configurations/example',
    );
    expect(() => selectRuleFiles(session.policyFiles.policy.guides, [manifest], session.repository)).toThrow(
        'does not exist: missing.md',
    );
});

test('Swift guides require parsed imports and ignore comments and strings', async () => {
    const absent = await generatedGuides('all', { 'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n' });
    const present = await generatedGuides('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
    for (const path of ['framework/swiftui/SWIFTUI.md', 'framework/uikit/UIKIT.md']) {
        expect(absent.has(`.gspot/guides/${path}`)).toBe(false);
        expect(present.has(`.gspot/guides/${path}`)).toBe(true);
    }
});
