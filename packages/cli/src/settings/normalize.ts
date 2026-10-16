import { compact } from '#cli/system/values.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { ParsedSettings } from '#cli/types/settings/file.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { architectureSchema } from '#cli/settings/schema/architecture.ts';
import { limitsSchema, namingSchema } from '#cli/settings/schema/tables.ts';
import { SCOPE_EMPTY_RECORDS, COMMAND_CHECK_DEFAULTS } from '#cli/config/settings/values.ts';

function normalizeScopeTables(written: NonNullable<ParsedSettings['scope']>[number]): Settings['scopeTables'][string] {
    const { architecture, tools, naming, coverage, docs, licenses, site, ...table } = written;
    const normalized = Object.fromEntries(
        SCOPE_EMPTY_RECORDS.flatMap(([name, field]) => {
            const value = { naming, coverage, docs, licenses, site }[name];
            return value === undefined ? [] : [[name, { ...value, [field]: [] }]];
        }),
    );
    const normalizedTools =
        tools === undefined
            ? undefined
            : compact({
                  ...tools,
                  eslint: tools.eslint === undefined ? undefined : { ...tools.eslint, override: [] },
              });
    return compact({
        ...table,
        ...normalized,
        written,
        architecture: architecture === undefined ? undefined : normalizeArchitecture({ ...architecture, module: [] }),
        tools: normalizedTools,
    });
}

/**
 * Fills the architecture table's lists and keeps its optional keys only when written.
 * @param written the table as written, if any
 * @returns the architecture configuration
 */
function normalizeArchitecture(written: ParsedSettings['architecture']): Settings['architecture'] {
    return {
        module: written?.module ?? [],
        roles: written?.roles ?? architectureSchema.shape.roles.parse(undefined),
    };
}

function normalizeChecks(checks: ParsedSettings['command_check']): Settings['check'] {
    return Object.fromEntries(
        (checks ?? []).map((entry) => {
            const name = entry.name;
            const { paths, ...definition } = compact(entry);
            return [
                name,
                {
                    ...definition,
                    name,
                    ...COMMAND_CHECK_DEFAULTS,
                    summary: entry.summary ?? `Runs the repository's own check ${name}.`,
                    why: 'The repository declared this command in gspot.toml as part of its gate.',
                    help: entry.help ?? 'Read the command output; this repository declares the check.',
                    files: {
                        ...COMMAND_CHECK_DEFAULTS.files,
                        extensions: [...COMMAND_CHECK_DEFAULTS.files.extensions],
                        filenames: [...COMMAND_CHECK_DEFAULTS.files.filenames],
                        tags: [...COMMAND_CHECK_DEFAULTS.files.tags],
                        paths,
                        kinds: [...COMMAND_CHECK_DEFAULTS.files.kinds],
                    },
                },
            ];
        }),
    );
}

/**
 * Build the settings values from the parsed document.
 * @param written the validated document
 * @returns the settings
 */
export function buildSettings(written: ParsedSettings): Settings {
    const { command_check: commandChecks, ...document } = written;
    const tables = compact({
        rules: written.rules,
        hooks: written.hooks,
        ci: written.ci,
    });
    const scopes = (written.scope ?? []).map((scope) => [scope.path, scope] as const);
    const scopeTables = Object.fromEntries(
        scopes.map(([path, scope]) => [trimTrailingSlashes(path), normalizeScopeTables(scope)]),
    );
    return {
        ...compact(document),
        written: written,
        level: settingsSchema.shape.level.parse(written.level),
        configurations: written.configurations,
        scope: Object.fromEntries(
            scopes.map(([path, scope]) => [
                trimTrailingSlashes(path),
                {
                    configurations: scope.configurations,
                    removed_configurations: scope.removed_configurations,
                },
            ]),
        ),
        removed_configurations: settingsSchema.shape.removed_configurations.parse(written.removed_configurations),
        limits: written.limits ?? limitsSchema.parse({}),
        naming: written.naming ?? namingSchema.parse({}),
        architecture: normalizeArchitecture(written.architecture),
        structure: {
            reexports: settingsSchema.shape.structure.unwrap().shape.reexports.parse(written.structure?.reexports),
        },
        format: compact({ ...written.format }),
        allowed_words: settingsSchema.shape.allowed_words.parse(written.allowed_words),
        tools: compact({ ...written.tools }),
        test_files: settingsSchema.shape.test_files.parse(written.test_files),
        ignore: (written.ignore ?? []).map((entry) => compact(entry)),
        check: normalizeChecks(commandChecks),

        ...tables,
        scopeTables,
    };
}
