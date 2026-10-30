import { ESLint } from 'eslint';
import { join, relative } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { openSession } from '#cli/planning/session.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { extractConfigFileName } from '#cli/configurations/tools.ts';
import { runGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import type { LintFinding, EslintConfiguration } from '#tests/types/tools.ts';

/**
Lint the files and keep the findings of these rules and fatal errors, sorted.
*/
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
        .toSorted(
            (left, right) =>
                compareText(left.file, right.file) ||
                left.line - right.line ||
                compareText(left.rule ?? '', right.rule ?? ''),
        );
}

/**
Link the test packages, run apply in a folder with a gspot.toml, and load the generated ESLint config file.
*/
export async function createEslint(root: string, options?: Pick<ESLint.Options, 'fix'>): Promise<ESLint> {
    runGitStep(root, ['init', '--quiet']);
    await linkInstalledModules(join(root, 'node_modules'));
    await runGspotStep({ root: root, run: runGspot }, ['apply']);
    const session = await openSession(root);
    const scope = session.scopes.find((each) =>
        each.configurations.some((configuration) =>
            configuration.configFiles.some((file) => extractConfigFileName(file.file) === 'eslint'),
        ),
    )?.path;
    if (scope === undefined) throw new Error('The sandbox selects no ESLint config file.');
    return new ESLint({
        ...options,
        cwd: root,
        overrideConfigFile: join(root, getConfigFilePath(session, 'eslint', scope)),
        overrideConfig: { languageOptions: { parserOptions: { noWarnOnMultipleProjects: true } } },
    });
}

/**
Read the rule table ESLint calculates for each file in a scoped repository.
*/
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

/**
List each rule name once, sorted.
*/
export function listFindingRules(findings: readonly LintFinding[]): (string | null)[] {
    return [...new Set(findings.map(({ rule }) => rule))].toSorted((left, right) =>
        compareText(String(left), String(right)),
    );
}
