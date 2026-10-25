import { join } from 'node:path';

process.stdout.write(await Bun.file(join(import.meta.dir, '..', 'lib', 'value.txt')).text());
