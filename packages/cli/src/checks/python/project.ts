// The project checks of a Python scope: import contracts, who owns the dependencies, and which files the type check leaves out.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import { pathMatcher } from '#cli/presets/claims.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const MANIFEST = 'pyproject.toml';
const LINT_TIMEOUT_MS = 600_000;
const BROKEN_CONTRACT = /^(?<name>.+?) BROKEN$/u;
const REQUIREMENTS_FILE = /(?:^|\/)requirements[^/]*\.txt$/u;
const PIP_INSTALL = /\bpip3? install\b/u;
const INSTALL_HOLDERS = ['.sh', '.bash', '.yml', '.yaml', '.toml', 'Dockerfile'];

function finding(input: EngineInput, at: { file: string; line: number }, rule: string, text: string): Finding {
    return { check: input.spec.name, file: at.file, line: at.line, rule, message: text, fixable: false };
}

function scopePath(input: EngineInput, path: string): string {
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

/**
 * Runs the import contracts of the scope. A project with no [tool.importlinter] table has none to run.
 * @param input the engine input
 * @returns one finding for each broken contract
 */
export async function importLinter(input: EngineInput): Promise<Finding[]> {
    const manifest = join(input.root, scopePath(input, MANIFEST));
    if (!existsSync(manifest) || !readFileSync(manifest, 'utf8').includes('[tool.importlinter')) return [];
    const result = await run(['lint-imports', '--no-cache'], {
        cwd: join(input.root, input.scope),
        timeoutMs: LINT_TIMEOUT_MS,
    });
    if (result.missing) throw new MissingToolError('The lint-imports command is not installed.');
    const broken = result.stdout.split('\n').flatMap((line) => {
        const name = BROKEN_CONTRACT.exec(line.trim())?.groups?.['name'];
        return name === undefined ? [] : [name];
    });
    const said = [result.stderr, result.stdout].join('').trim().split('\n').at(-1) ?? '';
    if (result.code !== 0 && broken.length === 0) throw new Error(`The lint-imports command failed: ${said}`);
    const at = { file: scopePath(input, MANIFEST), line: 1 };
    return broken.map((name) =>
        finding(input, at, 'contract', `The import contract "${name}" is broken; lint-imports prints the chain.`),
    );
}

/**
 * pyproject.toml owns every dependency: no hand-kept requirements file, and no pip install outside the allowed paths.
 * @param input the engine input
 * @returns the findings
 */
export function dependencyOwnership(input: EngineInput): Promise<Finding[]> {
    const allowed = (input.view.tool('dependencies')['pip_install_allowed'] as { paths: string[] }[] | undefined) ?? [];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const files = input.session.repository.files.filter((file) => file.nature === 'source');
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path))
        .map((file) =>
            finding(
                input,
                { file: file.path, line: 1 },
                'requirements-file',
                'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.',
            ),
        );
    const installs = files
        .filter((file) => !isAllowed(file.path) && INSTALL_HOLDERS.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            readFileSync(join(input.root, file.path), 'utf8')
                .split('\n')
                .flatMap((text, index): Finding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              finding(
                                  input,
                                  { file: file.path, line: index + 1 },
                                  'pip-install',
                                  'A pip install outside the lockfile installs versions nobody reviewed.',
                              ),
                          ]
                        : [],
                ),
        );
    return Promise.resolve([...requirements, ...installs]);
}

/**
 * Every path the type check leaves out still exists, so the list of exclusions never outlives its files.
 * @param input the engine input
 * @returns one finding for each exclusion that matches no tracked file
 */
export function typecheckMembership(input: EngineInput): Promise<Finding[]> {
    const excluded = (input.view.tool('basedpyright')['exclude'] as { paths: string[] }[] | undefined) ?? [];
    const paths = input.session.repository.files.map((file) => file.path);
    const stale = excluded
        .flatMap((entry) => entry.paths)
        .filter((pattern) => {
            const isMatch = pathMatcher([pattern, `${pattern}/**`]);
            return paths.every((path) => !isMatch(path));
        });
    return Promise.resolve(
        stale.map((pattern) =>
            finding(
                input,
                { file: 'gspot.toml', line: 1 },
                'stale-exclusion',
                `tools.basedpyright.exclude names ${pattern}, which matches no tracked file.`,
            ),
        ),
    );
}
