import { join } from 'node:path';
import { existsSync } from 'node:fs';

const bundle = process.argv[process.argv.indexOf('-resultBundlePath') + 1] ?? '';
const exitIndex = process.argv.indexOf('--exit');
if (process.argv.includes('--refuse-previous-bundle') && existsSync(join(bundle, 'data', 'previous'))) {
    process.stderr.write('Previous bundle survived\n');
    process.exitCode = 1;
} else {
    if (process.argv.includes('--mark-tested')) await Bun.write('tested.txt', 'tested');
    process.exitCode = exitIndex === -1 ? 0 : Number(process.argv[exitIndex + 1]);
}
