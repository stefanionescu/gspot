import { mkdirSync, writeFileSync } from 'node:fs';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';

const [styles = '', version = ''] = process.argv.slice(2);
const isColorOff = readEnvironmentVariable('NO_COLOR') === '1' && readEnvironmentVariable('FORCE_COLOR') === '0';
if (process.argv.includes('--version')) process.stdout.write(`${version}\n`);
else if (isColorOff) {
    for (const name of ['Google', 'write-good', 'proselint', 'alex', 'Harper', 'config/dictionaries']) {
        mkdirSync(`${styles}/${name}`, { recursive: true });
        writeFileSync(`${styles}/${name}/terms.yml`, 'package bytes\n');
    }
    writeFileSync(`${styles}/Google/terms.yml`, 'corrected bytes\n');
} else process.exitCode = 9;
