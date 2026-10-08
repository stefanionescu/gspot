import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { portableSegments } from '#cli/platform/root/rules.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import { COMPATIBILITY_DATE } from '#cli/config/checks/platform/cloudflare.ts';
import { parseWrangler, headerFindings, redirectFindings } from '#cli/parsers/cloudflare.ts';

function scopePathsNamed(input: CheckInput, name: string): string[] {
    return input.files.map((file) => file.path).filter((path) => path === name || path.endsWith(`/${name}`));
}

// Compares a copied types file with the output of wrangler in the same isolated directory.
async function isStale(input: CheckInput, path: string): Promise<boolean> {
    const before = readSource(input.root, path, input.reads);
    const name = input.view.settings['cloudflare.types_interface'];
    const result = await runCheckTool(
        input,
        ['wrangler', 'types', posix.relative(input.scope || '.', path), '--env-interface', String(name)],
        {
            cwd: input.scopeRoot,
        },
    );
    if (result.code !== 0)
        throw new Error(
            `The wrangler types command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    return !before.equals(readSource(input.root, path, input.reads));
}

/**
 * The syntax findings of every redirects file.
 * @param input the check input
 * @returns the findings
 */
export function redirects(input: CheckInput): Finding[] {
    return scopePathsNamed(input, '_redirects').flatMap((path) =>
        redirectFindings(readSource(input.root, path, input.reads).toString('utf8')).map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * Every wrangler configuration parses, names the worker, and pins a compatibility date.
 * @param input the check input
 * @returns the findings
 */
export function wrangler(input: CheckInput): Finding[] {
    const paths = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].flatMap((name) => scopePathsNamed(input, name));
    return paths.flatMap((path): Finding[] => {
        const { table, problem } = parseWrangler(readSource(input.root, path, input.reads).toString('utf8'), path);
        if (problem !== undefined) return [findingAt(input, { file: path, line: 1 }, 'syntax', problem)];
        const unnamed =
            typeof table['name'] === 'string'
                ? []
                : [findingAt(input, { file: path, line: 1 }, 'missing-name', 'The configuration names no worker.')];
        const date = table['compatibility_date'];
        const undated =
            typeof date === 'string' && COMPATIBILITY_DATE.test(date)
                ? []
                : [
                      findingAt(
                          input,
                          { file: path, line: 1 },
                          'compatibility-date',
                          'The configuration pins no compatibility_date, so the runtime behavior changes under it.',
                      ),
                  ];
        return [...unnamed, ...undated];
    });
}
/**
 * The syntax findings of every headers file.
 * @param input the check input
 * @returns the findings
 */
export function headers(input: CheckInput): Finding[] {
    return scopePathsNamed(input, '_headers').flatMap((path) =>
        headerFindings(readSource(input.root, path, input.reads).toString('utf8')).map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * A tracked environment types file matches what wrangler writes. An ignored one is written by the build and is left alone.
 * @param input the check input
 * @returns the findings
 */
export async function typesFresh(input: CheckInput): Promise<Finding[]> {
    const file = String(input.view.settings['cloudflare.types_file']);
    portableSegments(file);
    const paths = scopePathsNamed(input, file);
    if (paths.length === 0) return [];
    using scratchFolder = await copyIntoScratch(input);
    const scratch = scratchFolder.path;
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    const findings: Finding[] = [];
    for (const path of paths)
        if (await isStale(isolated, path))
            findings.push(
                findingAt(
                    input,
                    { file: path, line: 1 },
                    'stale',
                    'wrangler types writes this file differently. Run it and commit the result.',
                ),
            );
    return findings;
}
