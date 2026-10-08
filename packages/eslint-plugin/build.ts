// Build the plugin as Node ESM and CommonJS beside its declaration and license.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { rm, mkdir, copyFile } from 'node:fs/promises';
import { BUILD_FORMATS } from '#plugin/config/build.ts';
import packageManifest from '#plugin-package' with { type: 'json' };

const root = fileURLToPath(new URL('./', import.meta.url));
const distribution = join(root, 'dist');
await rm(distribution, { recursive: true, force: true });
await mkdir(distribution);
for (const [format, name] of BUILD_FORMATS) {
    const result = await Bun.build({
        entrypoints: [join(root, 'src/rules/public.ts')],
        outdir: distribution,
        naming: name,
        format,
        target: 'node',
        external: Object.keys(packageManifest.dependencies),
        minify: false,
        sourcemap: 'none',
    });
    if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
}
const declarations = Bun.spawn(
    [
        process.execPath,
        createRequire(import.meta.url).resolve('typescript/bin/tsc'),
        '--project',
        join(root, 'tsconfig.json'),
        '--emitDeclarationOnly',
        '--noEmit',
        'false',
    ],
    { stdout: 'inherit', stderr: 'inherit' },
);
if ((await declarations.exited) !== 0) throw new Error('Plugin declaration generation failed.');
await copyFile(join(root, '../..', 'LICENSE.md'), join(distribution, 'LICENSE.md'));
