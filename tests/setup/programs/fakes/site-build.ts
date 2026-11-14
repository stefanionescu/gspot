import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { splitAssignment } from '#tests/setup/system/programs.ts';
import { SITE_BUILD_OPTIONS } from '#tests/config/setup/programs.ts';
import { statSync, mkdirSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs';

const { values } = parseArgs({ options: SITE_BUILD_OPTIONS });
const pairs = values.copy ?? [];
for (const pair of pairs) {
    const [source, target] = splitAssignment(pair);
    const files = statSync(source).isDirectory()
        ? readdirSync(source, { recursive: true, encoding: 'utf8' }).filter((path) =>
              statSync(join(source, path)).isFile(),
          )
        : [''];
    for (const file of files) {
        mkdirSync(dirname(join(target, file)), { recursive: true });
        copyFileSync(join(source, file), join(target, file));
    }
}
if (values.import !== undefined) {
    const [name, target] = splitAssignment(values.import);
    const path = createRequire(join(process.cwd(), 'package.json')).resolve(name);
    const { value } = (await import(pathToFileURL(path).href)) as { value: string };
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
}
