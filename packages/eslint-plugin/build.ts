import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import packageManifest from '#plugin-package' with { type: 'json' };
import { rmSync, mkdirSync, renameSync, mkdtempSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(new URL(import.meta.url)));
const distribution = join(here, 'dist');

// Builds into a folder of its own, then renames each file over its copy in dist. When two checks in one run build at
// once, dist is never empty and never half written.
async function build(): Promise<void> {
    const staging = mkdtempSync(join(here, '.dist-'));
    try {
        for (const [format, name] of [
            ['esm', 'plugin.js'],
            ['cjs', 'plugin.cjs'],
        ] as const) {
            const result = await Bun.build({
                entrypoints: [join(here, 'src', 'plugin.ts')],
                outdir: staging,
                naming: name,
                format,
                target: 'node',
                external: Object.keys(packageManifest.dependencies),
                minify: false,
                sourcemap: 'none',
            });
            if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
        }
        writeFileSync(
            join(staging, 'plugin.d.ts'),
            "import type { TSESLint } from '@typescript-eslint/utils';\n\ndeclare const plugin: { meta: { name: string; version: string }; rules: Record<string, TSESLint.RuleModule<string, readonly unknown[]>>; configs: { recommended: TSESLint.FlatConfig.Config; all: TSESLint.FlatConfig.Config } };\nexport default plugin;\n",
        );
        copyFileSync(join(here, '../..', 'LICENSE.md'), join(staging, 'LICENSE.md'));
        mkdirSync(distribution, { recursive: true });
        for (const name of readdirSync(staging)) renameSync(join(staging, name), join(distribution, name));
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }
    console.log('built packages/eslint-plugin/dist/plugin.js and plugin.cjs');
}

async function main(): Promise<void> {
    let options: { help?: boolean; version?: boolean };
    try {
        ({ values: options } = parseArgs({
            options: { help: { type: 'boolean' }, version: { type: 'boolean' } },
            strict: true,
            allowPositionals: false,
        }));
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        console.error(
            'Invalid build arguments:',
            error.message,
            '\nRun bun packages/eslint-plugin/build.ts --help for usage.',
        );
        process.exitCode = 2;
        return;
    }
    if (options.help === true)
        console.log(
            [
                'Usage: bun packages/eslint-plugin/build.ts [options]',
                '',
                'Build the ESLint plugin as ESM and CommonJS.',
                '',
                'Options:',
                '  --help     Print this usage and exit',
                '  --version  Print the package version and exit',
                '',
                'Example: bun packages/eslint-plugin/build.ts',
            ].join('\n'),
        );
    else if (options.version === true) console.log(packageManifest.version);
    else await build();
}

await main();
