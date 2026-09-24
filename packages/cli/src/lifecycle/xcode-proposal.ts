// What init proposes for an Xcode project: the project of the scope, and a shared scheme.
import { posix } from 'node:path';
import type { ConfinedRoot } from '#cli/types/filesystem.ts';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';

const PROJECT_SUFFIX = '.xcodeproj';
const SCHEME_SUFFIX = '.xcscheme';
const PERIPHERY_FILE = '.periphery.yml';

// The first item under the schemes key of a Periphery file, without its quotes.
function listedScheme(text: string): string | undefined {
    const lines = text.split('\n').map((line) => line.trim());
    const item = lines[lines.indexOf('schemes:') + 1];
    if (!lines.includes('schemes:') || item?.startsWith('- ') !== true) return undefined;
    return item
        .slice(2)
        .trim()
        .replaceAll(/^["']|["']$/gu, '');
}

// The scheme a Periphery file already names wins: somebody chose it. Otherwise the first shared scheme by name.
function schemeOf(files: ConfinedRoot, scope: string, project: string): string | undefined {
    const periphery = files.read(posix.join(scope, PERIPHERY_FILE));
    const named = periphery === undefined ? undefined : listedScheme(periphery.bytes.toString('utf8'));
    if (named !== undefined) return named;
    const shared = files
        .list(posix.join(scope, project, 'xcshareddata', 'xcschemes'))
        .find((name) => name.endsWith(SCHEME_SUFFIX));
    return shared?.slice(0, -SCHEME_SUFFIX.length);
}

/**
 * The Xcode project and scheme of the first scope that holds a project, as the tools.xcode table.
 * @param root the repository root
 * @param scopePaths the scope paths, with an empty string for the root
 * @returns the scope that holds the project, the project and the scheme, or undefined when no scope holds a project
 */
export function xcodeProposal(
    root: string,
    scopePaths: string[],
): { scope: string; project: string; scheme?: string } | undefined {
    const files = openConfinedRoot(root);
    try {
        for (const scope of scopePaths) {
            const project = files.list(scope === '' ? undefined : scope).find((name) => name.endsWith(PROJECT_SUFFIX));
            if (project === undefined) continue;
            if (files.stat(posix.join(scope, project))?.isDirectory() !== true)
                throw new Error(`Xcode project is not a directory: ${posix.join(scope, project)}`);
            const scheme = schemeOf(files, scope, project);
            return scheme === undefined ? { scope, project } : { scope, project, scheme };
        }
        return undefined;
    } finally {
        files.close();
    }
}
