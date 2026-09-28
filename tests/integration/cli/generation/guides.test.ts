import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { parseManifest } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { selectRuleFiles } from '#cli/agents/assemble.ts';

async function generatedGuides(level: string, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript", "css", "vitest", "swift", "html", "python", "bash", "express", "nestjs", "svelte"]\n`,
        ...files,
    });
    const session = await openSession(sandbox.path);
    const proposal = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    return new Map(proposal.files.filter((file) => file.kind === 'rules').map((file) => [file.path, file.content]));
}

test('recommended guides omit marked sections and retain the next heading', async () => {
    const recommended = await generatedGuides('recommended', {});
    const all = await generatedGuides('all', {});
    const path = '.gspot/rules/language/TYPESCRIPT.md';
    expect(recommended.get(path)).not.toContain('## Declaration order');
    expect(all.get(path)).toContain('## Declaration order');
    expect(recommended.get(path)).toContain('## Rules not adopted');
    const writing = '.gspot/rules/general/prose/WRITING.md';
    expect(recommended.get(writing)).not.toContain('### Avoid marketing language');
    expect(all.get(writing)).toContain('### Avoid marketing language');
    expect(recommended.get(writing)).toContain('### Write dates and times unambiguously');
    const css = '.gspot/rules/language/CSS.md';
    expect(recommended.get(css)).not.toContain('## Selectors and layout');
    expect(all.get(css)).toContain('## Selectors and layout');
    expect(recommended.get(css)).toContain('prefers-reduced-motion');
    for (const [guide, convention, safety] of [
        ['language/TYPESCRIPT.md', '### Non-null assertion convention', '## Runtime boundaries'],
        ['language/PYTHON.md', '### Import conventions', '## Imports'],
        ['language/BASH.md', '### Entrypoint conventions', '## Shell options'],
        ['framework/svelte/SVELTE.md', '### Callback naming', '## Runes and reactivity'],
        ['language/SWIFT.md', '### API and ownership conventions', 'HTTPURLResponse'],
        ['language/HTML.md', '### Script and style placement', '## Script safety'],
        ['language/naming/CSS.md', '## Selector and file names', '# CSS Naming'],
        ['language/naming/HTML.md', '## Route and attribute names', '# HTML Naming'],
        ['language/python/PACKAGING.md', '## Source layout and import path', '## Import correctness'],
        ['framework/express/API.md', '## Organization and naming', '## Security'],
        ['framework/nestjs/NESTJS.md', '## Feature organization', '## Configuration and security'],
    ] as const) {
        expect(recommended.get(`.gspot/rules/${guide}`)).not.toContain(convention);
        expect(all.get(`.gspot/rules/${guide}`)).toContain(convention);
        expect(recommended.get(`.gspot/rules/${guide}`)).toContain(safety);
    }
});

test('conditional guides follow lockfile and dependency evidence', async () => {
    const absent = await generatedGuides('all', {});
    const present = await generatedGuides('all', {
        'bunfig.toml': '[test]\nroot = "tests"\n',
        'package.json': '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
    });
    for (const path of ['runtime/bun/BUN.md', 'tool/tailwind/TAILWIND.md', 'tool/playwright/PLAYWRIGHT.md']) {
        expect(absent.has(`.gspot/rules/${path}`)).toBe(false);
        expect(present.has(`.gspot/rules/${path}`)).toBe(true);
    }
});

test('a selected manifest cannot silently omit a missing guide asset', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = []\n' });
    const session = await openSession(sandbox.path);
    const manifest = parseManifest(
        '[configuration]\nname = "example"\nkind = "policy"\ntitle = "Example"\ndescription = "Example guide selection for this test."\n[rule_files]\ncode = [{path = "missing.md"}]\n',
        'configurations/example',
    );
    expect(() => selectRuleFiles(session.policyFiles.policy.rules, [manifest], session.repository)).toThrow(
        'does not exist: missing.md',
    );
});

test('Swift guides require parsed imports and ignore comments and strings', async () => {
    const absent = await generatedGuides('all', { 'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n' });
    const present = await generatedGuides('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
    for (const path of ['framework/swiftui/SWIFTUI.md', 'framework/uikit/UIKIT.md']) {
        expect(absent.has(`.gspot/rules/${path}`)).toBe(false);
        expect(present.has(`.gspot/rules/${path}`)).toBe(true);
    }
});
