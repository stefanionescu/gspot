// Lints sandbox files with the ESLint config that gspot generates, and reads its findings and rules.
import { ESLint } from 'eslint';
import { join, relative } from 'node:path';
import { openSession } from '#cli/session.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { findToolFilePath } from '#tests/setup/cli/config-files.ts';
import { runGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { extractToolFileName } from '#cli/configurations/declared-tools.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import type { LintFinding, EslintConfiguration } from '#tests/types/tool-output.ts';

/** Lint the files and keep the findings of these rules and fatal errors, sorted. */
export async function listLintFindings(
    eslint: ESLint,
    root: string,
    files: readonly string[],
    rules: readonly string[],
): Promise<LintFinding[]> {
    const results = await eslint.lintFiles([...files]);
    return results
        .flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId, fatal }) => fatal || ruleId === null || rules.includes(ruleId))
                .map(({ ruleId, line }) => ({
                    file: convertToPosixPath(relative(root, filePath)),
                    rule: ruleId,
                    line,
                })),
        )
        .toSorted(compareFindings);
}

/**
 * Links the test packages, runs apply, and loads the generated ESLint tool file.
 *
 * @param sandboxRoot folder with a gspot.toml.
 * @param options ESLint options that the test adds.
 * @returns ESLint set up with the generated tool file.
 */
export async function createEslint(sandboxRoot: string, options?: ESLint.Options): Promise<ESLint> {
    await linkInstalledModules(join(sandboxRoot, 'node_modules'));
    await runGspotStep({ root: sandboxRoot, environment: {}, run: runGspot }, ['apply']);
    const session = await openSession(sandboxRoot);
    const scope = session.scopes.find((entry) =>
        entry.configurations.some((configuration) =>
            configuration.toolFiles.some((file) => extractToolFileName(file.file) === 'eslint'),
        ),
    )?.folder.path;
    if (scope === undefined) throw new Error('The sandbox selects no ESLint tool file.');
    return new ESLint({
        ...options,
        cwd: sandboxRoot,
        overrideConfigFile: join(sandboxRoot, findToolFilePath(session, 'eslint', scope)),
        overrideConfig: { languageOptions: { parserOptions: { noWarnOnMultipleProjects: true } } },
    });
}

/** Sort findings by file, line, and rule. */
export function compareFindings(left: LintFinding, right: LintFinding): number {
    return (
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        (left.rule ?? '').localeCompare(right.rule ?? '')
    );
}

/** Read the rule table ESLint calculates for each file in a scoped repository. */
export async function readEslintRules(
    eslint: ESLint,
    files: readonly string[],
): Promise<Record<string, EslintConfiguration['rules']>> {
    return Object.fromEntries(
        await Promise.all(
            files.map(async (file) => {
                const configuration = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
                return [file, configuration.rules] as const;
            }),
        ),
    );
}

/** List each rule name once, sorted. */
export function listFindingRules(findings: readonly LintFinding[]): (string | null)[] {
    return [...new Set(findings.map(({ rule }) => rule))].toSorted((left, right) =>
        (left ?? '').localeCompare(right ?? ''),
    );
}
