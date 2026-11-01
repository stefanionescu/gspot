import { join } from 'node:path';
import { cpSync, rmSync } from 'node:fs';

const packageFolder = import.meta.dir;

rmSync(join(packageFolder, 'dist'), { recursive: true, force: true });
await Bun.build({
    entrypoints: [join(packageFolder, 'src/plugin.ts')],
    outdir: join(packageFolder, 'dist'),
    target: 'node',
    format: 'esm',
    packages: 'external',
});
cpSync(join(packageFolder, '../../LICENSE.md'), join(packageFolder, 'LICENSE.md'));
