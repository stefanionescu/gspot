import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/system/errors.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { TYPESCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import { readTsconfig, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { TSCONFIG_FILE, TSCONFIG_NAME } from '#cli/config/parsers/tsconfig.ts';
import { projectChecked, selectRequiredTsconfigOptions } from '#cli/checks/language/typescript/compiler.ts';

/**
 * One finding per required option a scope's tsconfig leaves off.
 * @param input the check input for the scope.
 * @returns the findings.
 */
export function typescriptTsconfig(input: CheckInput): Finding[] {
    const project = readTsconfigProject(
        input.root,
        input.scope.scope.path,
        input.files.filter((file) => file.tags.includes(TYPESCRIPT_TAG)).map((file) => file.path),
        input.reads,
    );
    const scopeTsconfig =
        project === undefined
            ? joinScope(input.scope.scope.path, TSCONFIG_FILE)
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
    const required = selectRequiredTsconfigOptions(input.settingsFile.settings.level, input.scope.selected);
    const projects = [...candidates].flatMap((path) => {
        const parsed = readTsconfig(input.root, join(input.root, path), input.reads);
        return parsed === undefined ? [] : [{ path, parsed }];
    });
    const unchecked = projects.filter(
        ({ path }) =>
            !projectChecked(input.reads, {
                check: input.check.name,
                path: join(input.root, path),
                scope: input.scope.scope.path,
                required: required,
            }),
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
