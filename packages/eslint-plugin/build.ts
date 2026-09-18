import { dirname, join } from 'node:path';
// Builds the plugin to ESM and CommonJS under dist/, with a declaration file.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const here = dirname(new URL(import.meta.url).pathname);
const distribution = join(here, 'dist');

async function build(): Promise<void> {
    rmSync(distribution, { recursive: true, force: true });
    mkdirSync(distribution, { recursive: true });
    for (const [format, name] of [
        ['esm', 'plugin.js'],
        ['cjs', 'plugin.cjs'],
    ] as const) {
        const result = await Bun.build({
            entrypoints: [join(here, 'src', 'plugin.ts')],
            outdir: distribution,
            naming: name,
            format,
            target: 'node',
            external: ['@typescript-eslint/utils', 'picomatch'],
            minify: false,
            sourcemap: 'none',
        });
        if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
    }
    writeFileSync(
        join(distribution, 'plugin.d.ts'),
        "import type { TSESLint } from '@typescript-eslint/utils';\n\ndeclare const plugin: { meta: { name: string; version: string }; rules: Record<string, TSESLint.RuleModule<string, readonly unknown[]>>; configs: { recommended: TSESLint.FlatConfig.Config } };\nexport default plugin;\n",
    );
    console.log('built packages/eslint-plugin/dist/plugin.js and plugin.cjs');
}

await build();
