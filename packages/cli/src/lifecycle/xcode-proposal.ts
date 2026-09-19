// What init proposes for an Xcode project: the project of the scope, and a shared scheme.
import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

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

function entries(folder: string): string[] {
    return existsSync(folder) ? readdirSync(folder).toSorted((a, b) => a.localeCompare(b)) : [];
}

// The scheme a Periphery file already names wins: somebody chose it. Otherwise the first shared scheme by name.
function schemeOf(folder: string, project: string): string | undefined {
    const periphery = join(folder, PERIPHERY_FILE);
    const named = existsSync(periphery) ? listedScheme(readFileSync(periphery, 'utf8')) : undefined;
    if (named !== undefined) return named;
    const shared = entries(join(folder, project, 'xcshareddata', 'xcschemes')).find((name) =>
        name.endsWith(SCHEME_SUFFIX),
    );
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
    for (const scope of scopePaths) {
        const folder = join(root, scope);
        const project = entries(folder).find((name) => name.endsWith(PROJECT_SUFFIX));
        if (project === undefined) continue;
        const scheme = schemeOf(folder, project);
        return scheme === undefined ? { scope, project } : { scope, project, scheme };
    }
    return undefined;
}
