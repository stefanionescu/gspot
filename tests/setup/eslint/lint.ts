import { ESLint } from 'eslint';
import { join, relative } from 'node:path';
import { openSession } from '#cli/session.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { extractConfigFileName } from '#cli/configurations/tools.ts';
import { runGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { findConfigFilePath } from '#tests/setup/cli/config-files.ts';
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
 * Link the test packages, run apply, and load the generated ESLint config file.
 *
 * @param sandboxRoot folder with a gspot.toml.
 * @param options more ESLint options.
 * @returns ESLint set up with the generated config file.
 */
export async function createEslint(sandboxRoot: string, options?: ESLint.Options): Promise<ESLint> {
    await linkInstalledModules(join(sandboxRoot, 'node_modules'));
    await runGspotStep({ root: sandboxRoot, environment: {}, run: runGspot }, ['apply']);
    const session = await openSession(sandboxRoot);
    const scope = session.scopes.find((each) =>
        each.configurations.some((configuration) =>
            configuration.configFiles.some((file) => extractConfigFileName(file.file) === 'eslint'),
        ),
    )?.folder.path;
    if (scope === undefined) throw new Error('The sandbox selects no ESLint config file.');
    return new ESLint({
        ...options,
        cwd: sandboxRoot,
        overrideConfigFile: join(sandboxRoot, findConfigFilePath(session, 'eslint', scope)),
        overrideConfig: { languageOptions: { parserOptions: { noWarnOnMultipleProjects: true } } },
    });
}

/** Order two findings by file, line, and rule. */
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
