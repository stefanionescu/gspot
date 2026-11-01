import { rmSync } from 'node:fs';
import { join } from 'node:path';

const packageFolder = import.meta.dir;

rmSync(join(packageFolder, 'dist'), { recursive: true, force: true });
await Bun.build({
    entrypoints: [join(packageFolder, 'src/plugin.ts')],
    outdir: join(packageFolder, 'dist'),
    target: 'node',
    format: 'esm',
    packages: 'external',
});
