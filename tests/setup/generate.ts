// Reads generated tool configurations and ESLint findings for tests.
import { z } from 'zod';
import { ESLint } from 'eslint';
import { join, relative } from 'node:path';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { openSession } from '#cli/commands/session.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { ESLINT_SEVERITIES } from '#tests/config/eslint/lint-rules.ts';
import type { LintFinding, EslintConfiguration } from '#tests/types/tool-output.ts';

/** Native ESLint messages limited to the rules a retained test checks. */
async function lintFindings(
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

async function readEslintConfiguration(eslint: ESLint, file: string): Promise<EslintConfiguration> {
    const config: unknown = await eslint.calculateConfigForFile(file);
    return eslintConfigurationSchema.parse(config);
}

// What sandbox settings generate: the files its selected configurations write, and the ESLint instance its
// configuration produces.

const eslintConfigurationSchema = z.object({
    rules: z.record(z.string(), z.tuple([z.literal(ESLINT_SEVERITIES)], z.unknown())),
    languageOptions: z.object({
        globals: z.record(z.string(), z.union([z.string(), z.boolean()])).default({}),
        sourceType: z.string(),
    } satisfies SchemaShape<EslintConfiguration['languageOptions']>),
    plugins: z.record(z.string(), z.unknown()),
    settings: z
        .object({
            next: z
                .object({ rootDir: z.string() } satisfies SchemaShape<
                    NonNullable<EslintConfiguration['settings']['next']>
                >)
                .optional(),
        } satisfies SchemaShape<Pick<EslintConfiguration['settings'], 'next'>>)
        .catchall(z.unknown())
        .default({}) satisfies z.ZodType<EslintConfiguration['settings']>,
    linterOptions: z.object({
        reportUnusedDisableDirectives: z.literal(ESLINT_SEVERITIES),
    } satisfies SchemaShape<EslintConfiguration['linterOptions']>),
} satisfies SchemaShape<EslintConfiguration>);

/**
 * Links installed test packages, writes outputs through the managed lifecycle, and loads the ESLint configuration.
 * @param root the sandbox with its gspot.toml.
 * @returns ESLint reading the generated configuration.
 */
async function createEslint(root: string, options: ESLint.Options = {}): Promise<ESLint> {
    await linkInstalledModules(join(root, 'node_modules'));
    const session = await openSession(root);
    using log = openWriter(root);
    const generated = emitAll(session);
    writeGeneratedFiles(session, generated, log);
    return new ESLint({ ...options, cwd: root, overrideConfigFile: join(root, '.gspot/config/eslint.config.mjs') });
}

/**
 * Creates a repository with the settings and files, and returns the content of one generated file.
 * @param settings the gspot.toml text.
 * @param path the generated path to read.
 * @param files further files the repository holds.
 * @returns the generated content.
 */
async function emitFile(settings: string, path: string, files: Record<string, string> = {}): Promise<string> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...files, 'gspot.toml': settings });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const file = output.files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`The sandbox generates no ${path}.`);
    return file.content;
}

export { emitFile, lintFindings, createEslint, readEslintConfiguration };

/** Compare native findings by file, line, and rule for stable assertions. */
export function compareFindings(left: LintFinding, right: LintFinding): number {
    return (
        left.file.localeCompare(right.file) ||
        left.line - right.line ||
        (left.rule ?? '').localeCompare(right.rule ?? '')
    );
}
