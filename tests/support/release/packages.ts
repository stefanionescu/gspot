import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import releaseTargets from '#cli/platform/release-targets.json' with { type: 'json' };

// The C library of a Linux host, which selects its release target; other platforms have none.
function hostLibc(): string | null {
    if (process.platform !== 'linux') return null;
    const { familySync } = requireCli('detect-libc') as { familySync: () => string | null };
    return familySync();
}

// Consumer processes cannot discover executables from the source checkout.
function isOutsideCheckout(entry: string): boolean {
    const path = relative(root, resolve(entry));
    return path.startsWith(`..${sep}`) || path === '..' || isAbsolute(path);
}

const inherited = environmentVariables();

export const root = fileURLToPath(new URL('../../..', import.meta.url));
export const requireCli = createRequire(join(root, 'packages/cli/package.json'));
export const host = releaseTargets.find(
    (target) => target.os === process.platform && target.cpu === process.arch && target.libc === hostLibc(),
)!;
export const BINARY = host.binary;
export const RELEASE_TIMEOUT_MS = 180_000;

export const environment: Record<string, string | undefined> = {
    ...inherited,
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (inherited['PATH'] ?? '').split(delimiter).filter(isOutsideCheckout).join(delimiter),
};

export function preparePackages(work: string): string {
    const checkout = join(work, 'publish');
    for (const path of [
        'dist',
        'packages/npm',
        'packages/cli/package.json',
        'packages/cli/scripts/publish.ts',
        'packages/cli/scripts/targets.ts',
        'tsconfig.json',
    ]) {
        const target = join(checkout, path);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(join(root, path), target, { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(checkout, 'node_modules'), 'dir');
    symlinkSync(join(root, 'packages/cli/node_modules'), join(checkout, 'packages/cli/node_modules'), 'dir');
    return checkout;
}
