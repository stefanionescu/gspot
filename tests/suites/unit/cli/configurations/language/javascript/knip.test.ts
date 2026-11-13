import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { compareText } from '#cli/system/text.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkInstalledModules, toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { writeLauncher } from '#tests/setup/system/fakes.ts';
import type { KnipConfig } from '#tests/types/configurations.ts';

/**
Give the project a Knip that gspot accepts. gspot refuses a tool file that links out of the repository, so the package
holds its own package.json and an entry file that loads the installed Knip.
*/
async function linkKnip(root: string): Promise<void> {
    const knip = join(toolModules, 'knip');
    const modules = join(root, GSPOT_PATHS.nodeModules);
    const entry = pathToFileURL(join(knip, 'bin/knip.js')).href;
    await createFileTree(join(modules, 'knip'), {
        'package.json': await readFile(join(knip, 'package.json'), 'utf8'),
        'bin/knip.js': `import ${JSON.stringify(entry)};\n`,
    });
    await writeLauncher(join(modules, '.bin/knip'), ['node', join(modules, 'knip/bin/knip.js')]);
    await linkInstalledModules(modules);
}

async function writeKnipProject(root: string, settings: string, files: Record<string, string>): Promise<void> {
    const target = getManifestTarget('javascript', 'knip.json');
    const configuration = await buildGeneratedFile(settings, target, files);
    await createFileTree(root, { ...files, 'gspot.toml': settings, [target]: configuration });
    await linkKnip(root);
}

async function listKnipFindings(root: string, rule: string): Promise<Array<{ file: string; rule: string }>> {
    const findings = await runSandboxCheck(root, 'javascript/knip');
    return findings.filter((finding) => finding.rule === rule).map(({ file }) => ({ file, rule }));
}

const KNIP_COMPONENT_FILES = {
    'package.json':
        '{"name":"native-project","private":true,"type":"module","workspaces":["child"],"dependencies":{"vue":"3.5.0","svelte":"5.57.0","astro":"7.3.2","@astrojs/mdx":"4.0.0"}}',
    'main.js': 'export const used = 1;\n',
    'native-tests/widget.js': 'export const widget = 1;\n',
    'space name.jsx': 'export const unused = <div />;\n',
    'unused.vue': '<template><div>Unused</div></template>\n',
    'unused.svelte': '<div>Unused</div>\n',
    'unused.astro': `---
const unused = 1;
---
<div />
`,
    'unused.mdx': '# Unused\n',
    'child/package.json': '{"name":"child-project","private":true,"type":"module"}',
    'child/main.js': 'export const child = 1;\n',
    'child/verification/widget.js': 'export const widget = 1;\n',
    'child/unused.jsx': 'export const unused = <div />;\n',
} as const;

const KNIP_UNUSED_FILES = [
    'child/unused.jsx',
    'space name.jsx',
    'unused.astro',
    'unused.mdx',
    'unused.svelte',
    'unused.vue',
] as const;

test('Knip finds unused framework component files and uses the entry points of each scope', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: `\ntest_files = ["native-tests/**"]\n[javascript]\nentry_files = ["main.js"]\n[[scope]]\npath = "child"\n\nconfigurations = ["javascript"]\ntest_files = ["verification/**"]\n[scope.javascript]\nentry_files = ["main.js"]\n`,
    });
    await writeKnipProject(sandbox.path, settings, KNIP_COMPONENT_FILES);
    const findings = await listKnipFindings(sandbox.path, 'files');
    expect(findings.toSorted((left, right) => compareText(left.file, right.file))).toStrictEqual(
        KNIP_UNUSED_FILES.map((file) => ({
            file,
            rule: 'files',
        })),
    );
});

test('Knip takes its default entry files at the root and under src', async () => {
    await using sandbox = await createGitSandbox({});
    const files = {
        'package.json': '{"name":"native-project","private":true,"type":"module"}',
        'cli.ts': 'export const value = 1;\n',
        'src/main.tsx': 'export const value = 1;\n',
        'src/unused.ts': 'export const value = 1;\n',
    };
    await writeKnipProject(sandbox.path, buildSandboxSettings(['javascript']), files);
    expect(await listKnipFindings(sandbox.path, 'files')).toStrictEqual([{ file: 'src/unused.ts', rule: 'files' }]);
});

test('Knip reports each unused dependency that you declare, also when it names a gspot tool', async () => {
    await using sandbox = await createGitSandbox({});
    const files = {
        'package.json':
            '{"name":"native-project","private":true,"type":"module","dependencies":{"vale":"0.0.0","sample-unused-package":"1.0.0","prettier":"0.0.0-test","eslint-config-prettier":"0.0.0-test","@gspothq/eslint-plugin":"0.0.0"}}',
        'main.js': 'export const value = 1;\n',
    };
    await writeKnipProject(sandbox.path, buildSandboxSettings(['javascript'], { level: 'all' }), files);
    expect(await listKnipFindings(sandbox.path, 'dependencies')).toStrictEqual(
        Array.from({ length: 5 }, () => ({ file: 'package.json', rule: 'dependencies' })),
    );
});

const KNIP_POINTER_FILES = {
    'package.json': '{"name":"pointer-project","private":true,"type":"module","workspaces":["child"]}',
    'README.md': '# Link file project\n',
    'child/README.md': '# Child pointer file project\n',
    'main.js': 'export const root = 1;\n',
    'eslint.config.js': 'export default {};\n',
    'child/package.json': '{"name":"child-pointer-project","private":true,"type":"module"}',
    'child/main.js': 'export const child = 1;\n',
    'child/eslint.config.js': 'export default {};\n',
} as const;

test('Knip treats script configuration files as entries and ignores pointer files', async () => {
    await using sandbox = await createGitSandbox({
        ...KNIP_POINTER_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'markdown'], {
            level: 'all',
            tables: `\n[javascript]\nentry_files = ["main.js"]\n[[scope]]\npath = "child"\n\nconfigurations = ["javascript", "markdown"]\n[scope.javascript]\nentry_files = ["main.js"]\n`,
        }),
    });

    const session = await openSession(sandbox.path);
    const generated = buildGeneratedFiles(session).files;
    const pointers = generated.filter(({ path }) =>
        ['eslint.config.mjs', 'prettier.config.mjs', '.markdownlint.jsonc'].includes(basename(path)),
    );
    const configuration = generated.find(({ path }) => path === getManifestTarget('javascript', 'knip.json'))!;
    await createFileTree(
        sandbox.path,
        Object.fromEntries([configuration, ...pointers].map(({ path, content }) => [path, content])),
    );
    await linkKnip(sandbox.path);
    await writeFile(join(sandbox.path, 'unused.js'), 'export const unused = 1;\n');
    expect(await listKnipFindings(sandbox.path, 'files')).toStrictEqual([{ file: 'unused.js', rule: 'files' }]);
});

test("Knip gets each scope's test_files as entry points without sibling leaks", async () => {
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: 'test_files = ["specifications/**"]\n[[scope]]\npath = "app"\n\ntest_files = ["verification/**"]\n[[scope]]\npath = "app/deep"\n\ntest_files = []\n[[scope]]\npath = "sibling"\n\ntest_files = ["sibling-tests/**"]\n',
    });
    const content = await buildGeneratedFile(settings, getManifestTarget('javascript', 'knip.json'), {
        'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
        'source.js': 'export {};\n',
        'app/package.json': '{"private":true}',
        'app/deep/package.json': '{"private":true}',
        'sibling/package.json': '{"private":true}',
    });
    const { workspaces } = JSON.parse(content) as KnipConfig;
    const testGlobs = new Set(['**/tests/**', 'specifications/**', 'verification/**', 'sibling-tests/**']);
    expect(
        Object.fromEntries(
            Object.entries(workspaces).map(([name, { entry }]) => [name, entry.filter((glob) => testGlobs.has(glob))]),
        ),
    ).toStrictEqual({
        '.': ['specifications/**'],
        app: ['verification/**'],
        'app/deep': [],
        sibling: ['sibling-tests/**'],
    });
});

const KNIP_WORKSPACE_FILES = {
    'package.json': '{"private":true,"type":"module","workspaces":["api","web"]}\n',
    'api/package.json': '{"name":"api","private":true}\n',
    'api/serve.js': '',
    'web/package.json': '{"name":"web","private":true}\n',
    'lib/index.js': '',
} as const;

test('Knip workspaces come from package workspaces, your entries and the configuration entry files', async () => {
    const files = KNIP_WORKSPACE_FILES;
    const settings = buildSandboxSettings(['javascript'], {
        tables: '[javascript]\nentry_files = ["cli.js"]\n[[scope]]\npath = "api"\n\nconfigurations = ["javascript"]\n[scope.javascript]\nentry_files = ["serve.js"]\n[[scope]]\npath = "lib"\n\nconfigurations = ["javascript"]\n',
    });
    const knip = JSON.parse(
        await buildGeneratedFile(settings, getManifestTarget('javascript', 'knip.json'), files),
    ) as KnipConfig;
    const namedFiles = new Set(['cli.js', 'serve.js', 'eslint.config.mjs']);
    expect(
        Object.fromEntries(
            Object.entries(knip.workspaces).map(([name, { entry }]) => [
                name,
                entry.filter((glob) => namedFiles.has(glob)),
            ]),
        ),
    ).toStrictEqual({ '.': ['cli.js', 'eslint.config.mjs'], api: ['serve.js'], web: [] });
});

test('Knip writes only the ignores of code files and the tool binaries that a script calls', async () => {
    const settings = buildSandboxSettings(['javascript'], {
        tables: '[[ignore]]\ncheck = "javascript/knip"\npaths = ["vendor/**/*.js", "vendor/**/*.md"]\nreason = "The vendored files keep their upstream layout."\n',
    });
    const knip = JSON.parse(
        await buildGeneratedFile(settings, getManifestTarget('javascript', 'knip.json'), {
            'package.json': '{"private":true,"type":"module","scripts":{"lint":"eslint . && echo done"}}',
            'vendor/lib/index.js': 'export const value = 1;\n',
            'vendor/lib/README.md': '# Library\n',
        }),
    ) as KnipConfig;
    expect(knip.ignoreBinaries).toStrictEqual(['eslint']);
    expect(knip.ignore).toContain('**/node_modules/**');
    expect(knip.ignore).not.toContain('**/.env');
    expect(knip.ignore.filter((glob) => glob.startsWith('vendor/'))).toStrictEqual(['vendor/**/*.js']);
});

test('Knip keeps a declared package that a mise file task runs through a package runner', async () => {
    const knip = JSON.parse(
        await buildGeneratedFile(buildSandboxSettings(['javascript']), getManifestTarget('javascript', 'knip.json'), {
            'package.json': JSON.stringify({
                private: true,
                devDependencies: { wrangler: '4.0.0', 'left-pad': '1.3.0' },
            }),
            'main.js': 'export const value = 1;\n',
            '.mise/tasks/deploy':
                '#!/usr/bin/env bash\n# npx left-pad\necho "#" issue#4; bunx wrangler@4 deploy # npx left-pad\n',
            'mise-tasks/typecheck': '#!/usr/bin/env bash\nnpx --yes undeclared-tool\n',
        }),
    ) as { ignoreDependencies: string[] };
    expect(knip.ignoreDependencies).toContain('wrangler');
    expect(knip.ignoreDependencies).not.toContain('left-pad');
    expect(knip.ignoreDependencies).not.toContain('undeclared-tool');
});

test('Knip treats script patterns and the ESLint import chain as used entries, and reports an unused module', async () => {
    await using sandbox = await createGitSandbox({});
    await writeKnipProject(sandbox.path, buildSandboxSettings(['javascript']), {
        'package.json': '{"private":true,"type":"module"}',
        'scripts/check-notes.mjs': 'console.log("checked");\n',
        'tools/lint/plugin.mjs': EMPTY_DEFAULT_SOURCE,
        'eslint.config.mjs': 'import plugin from "./tools/lint/plugin.mjs"; export default [plugin];\n',
        'unused.mjs': 'export const unused = 1;\n',
    });
    expect(await listKnipFindings(sandbox.path, 'files')).toStrictEqual([{ file: 'unused.mjs', rule: 'files' }]);
});
