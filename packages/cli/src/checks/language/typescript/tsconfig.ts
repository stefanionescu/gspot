import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/system/errors.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { TYPESCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import { selectRequiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import { projectChecked } from '#cli/checks/language/typescript/compiler.ts';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { TSCONFIG_FILE, TSCONFIG_NAME } from '#cli/config/parsers/tsconfig.ts';

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the check input for the scope.
 * @returns the findings.
 */
export function typescriptTsconfig(input: CheckInput): Finding[] {
    const project = readTsconfigProject(
        input.root,
        input.selection.scope.path,
        input.files.filter((file) => file.tags.includes(TYPESCRIPT_TAG)).map((file) => file.path),
        input.reads,
    );
    const scopeTsconfig =
        project === undefined
            ? joinScope(input.selection.scope.path, TSCONFIG_FILE)
            : convertToPosixPath(relative(input.root, project.path));
    const candidates = new Set([
        scopeTsconfig,
        ...input.files
            .map((file) => file.path)
            .filter((path) => {
                const name = posix.basename(path);
                return TSCONFIG_NAME.test(name);
            }),
    ]);
    const required = selectRequiredTsconfigOptions(input.settingsFile.settings.level, input.selection.selected);
    const projects = [...candidates].flatMap((path) => {
        const parsed = readTsconfig(input.root, join(input.root, path), input.reads);
        return parsed === undefined ? [] : [{ path, parsed }];
    });
    const unchecked = projects.filter(
        ({ path }) =>
            !projectChecked(
                input.reads,
                input.check.name,
                join(input.root, path),
                input.selection.scope.path,
                required,
            ),
    );
    if (projects.length > 0 && unchecked.length === 0)
        throw new GspotError('skip', 'An ancestor compiler check covers this project.');
    return unchecked.flatMap(({ path, parsed }) =>
        Object.keys(required)
            .filter((option) => parsed.options[option] !== true)
            .map((option) => ({
                ...findingAt(input, { file: path }, option, `${option} is not on in this tsconfig.`),
                help: 'Enable this compiler option in the TypeScript tool file.',
            })),
    );
}
