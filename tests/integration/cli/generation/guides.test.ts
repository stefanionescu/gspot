import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseManifest } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { selectRuleFiles } from '#cli/rules/assemble.ts';
import { emitted } from '#tests/harness/cli/generated.ts';

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
    const plan = emitted(session);
    return new Map(plan.files.filter((file) => file.kind === 'rules').map((file) => [file.path, file.content]));
}

test('recommended guides omit marked sections and retain the next heading', async () => {
    const recommended = await generatedGuides('recommended', {});
    const all = await generatedGuides('all', {});
    const path = '.gspot/rules/language/typescript/TYPESCRIPT.md';
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
    for (const path of ['language/javascript/BUN.md', 'language/css/TAILWIND.md', 'tool/vitest/PLAYWRIGHT.md']) {
        expect(absent.has(`.gspot/rules/${path}`)).toBe(false);
        expect(present.has(`.gspot/rules/${path}`)).toBe(true);
    }
});

test('a kit cannot install a conditional rule its rules folder does not hold', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf([]) });
    const session = await openSession(sandbox.path);
    const manifest = parseManifest(
        '[kit]\ntitle = "Example"\ndescription = "Example rule selection for this test."\n[rules]\n"MISSING.md" = {dependencies = ["example"]}\n',
        'kits/general/example',
    );
    expect(() => selectRuleFiles(session.policyFiles.policy.rules, [manifest], session.repository)).toThrow(
        'The rule MISSING.md of the example kit does not exist.',
    );
});

test('Swift guides require parsed imports and ignore comments and strings', async () => {
    const absent = await generatedGuides('all', { 'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n' });
    const present = await generatedGuides('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
    for (const path of ['language/swift/SWIFTUI.md', 'language/swift/UIKIT.md']) {
        expect(absent.has(`.gspot/rules/${path}`)).toBe(false);
        expect(present.has(`.gspot/rules/${path}`)).toBe(true);
    }
});
