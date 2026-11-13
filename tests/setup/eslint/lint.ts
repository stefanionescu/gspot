import { join, relative } from 'node:path';

import { ESLint } from 'eslint';

import { openSession } from '#cli/engine/session.ts';
import { extractConfigName } from '#cli/manifests/checks.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text/order.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import type { EslintConfiguration, LintFinding } from '#tests/types/setup.ts';

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
                .filter(({ ruleId, fatal }) => fatal === true || ruleId === null || rules.includes(ruleId))
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

export async function buildEslint(root: string, options?: Pick<ESLint.Options, 'fix'>): Promise<ESLint> {
    runGitStep(root, ['init', '--quiet']);
    await linkInstalledModules(join(root, 'node_modules'));
    await applyGeneratedFiles(root);
    const session = await openSession(root);
    const scope = session.scopes.find((each) =>
        each.configurations.some((configuration) =>
            configuration.configs.some((file) => extractConfigName(file.file) === 'eslint'),
        ),
    )?.path;
    if (scope === undefined) throw new Error('The sandbox selects no ESLint config file.');
    return new ESLint({
        ...options,
        cwd: root,
        overrideConfigFile: join(root, getConfigPath(session, 'eslint', scope)),
    });
}

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
