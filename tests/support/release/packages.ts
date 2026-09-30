import { fileURLToPath } from 'node:url';
import { environmentVariables } from '#cli/platform/environment.ts';
import { sep, resolve, relative, delimiter, isAbsolute } from 'node:path';

const inherited = environmentVariables();

export const root = fileURLToPath(new URL('../../..', import.meta.url));
// The environment of an installed consumer: no module path overrides, and no folder of this checkout on PATH.
export const environment: Record<string, string | undefined> = {
    ...inherited,
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (inherited['PATH'] ?? '')
        .split(delimiter)
        .filter((entry) => {
            const path = relative(root, resolve(entry));
            return path.startsWith(`..${sep}`) || path === '..' || isAbsolute(path);
        })
        .join(delimiter),
};
