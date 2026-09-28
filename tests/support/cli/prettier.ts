import prettier from 'prettier';
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import type { ResolveConfigOptions } from 'prettier';
import { initArgs } from '#tests/support/cli/init.ts';
import type { SpawnOutcome } from '#tests/types/cli.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';

import {
    PRETTIER_IGNORE_FILES,
    PRETTIER_IGNORE_RULES,
    PRETTIER_IGNORE_SOURCE,
} from '#tests/config/acceptance/source/cli/cli.ts';

/**
 * Format the same source under each file's resolved native configuration.
 * @param root the fixture root
 * @param paths the files whose selectors determine formatting
 * @param source the source text to format
 * @param options the native configuration discovery options
 * @returns formatted text for each fixture path
 */
export async function formatSources(
    root: string,
    paths: readonly string[],
    source: string,
    options: ResolveConfigOptions,
): Promise<Map<string, string>> {
    const rendered = new Map<string, string>();
    for (const path of paths) {
        const filepath = join(root, path);
        const resolved = await prettier.resolveConfig(filepath, options);
        rendered.set(path, await prettier.format(source, { ...resolved, filepath }));
    }
    return rendered;
}

/** Prepares a formatter project with authored ignore rules and the all-level policy. */
export async function prepareIgnoredFormatter(
    root: string,
): Promise<{ initialized: SpawnOutcome; level: SpawnOutcome }> {
    await createFileTree(root, {
        '.prettierignore': PRETTIER_IGNORE_RULES,
        '.prettierrc.json': '{"semi":false}\n',
        ...Object.fromEntries(PRETTIER_IGNORE_FILES.map((file) => [file, PRETTIER_IGNORE_SOURCE])),
    });
    chmodSync(join(root, '.prettierignore'), 0o640);
    const initialized = await run(root, [...initArgs(['formatting']), '--json']);
    if (initialized.code !== 0)
        throw new Error(`Formatter fixture initialization failed: ${initialized.stdout}${initialized.stderr}`);
    await installPrivateTools(root);
    const level = await run(root, ['set', 'level', 'all']);
    return { initialized, level };
}
