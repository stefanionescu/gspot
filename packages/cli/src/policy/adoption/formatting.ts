import { parseBuffer } from 'editorconfig';
import { basename, dirname } from 'node:path';
import { compact } from '#cli/policy/normalize.ts';
import { policySchema } from '#cli/policy/schema.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';
import { parseConfigurationSource } from '#cli/policy/adoption/source.ts';
import type { ExistingTooling } from '#cli/types/repository/repository.ts';
import { formatRequest, formatResponse } from '#cli/evaluation/protocol.ts';
import type { AdoptionResult, AdoptedFormatting, ConfigurationSource } from '#cli/types/policy/adoption.ts';

async function adoptFormatting(
    root: string,
    configurations: { from: string; source?: ConfigurationSource }[],
    ignorePaths: string[],
    nativeDefaults = false,
): Promise<AdoptedFormatting> {
    const base = configurations.find((entry) => !entry.from.includes('/'));
    const from = base?.from ?? '.prettierrc.json';
    const source = base === undefined ? { parsed: {} } : base.source;
    const request = formatRequest.safeParse({
        root,
        from,
        nativeDefaults,
        ignorePaths,
        ...(source === undefined ? {} : { source: source.parsed }),
        nested: configurations
            .filter((entry) => entry.from.includes('/'))
            .toSorted((a, b) => a.from.split('/').length - b.from.split('/').length)
            .map((entry) => ({
                from: entry.from,
                ...(entry.source === undefined ? {} : { source: entry.source.parsed }),
            })),
    });
    if (!request.success)
        throw new Error(
            `Formatter configuration cannot be replaced without losing settings: ${request.error.issues.map((issue) => issue.message).join('; ')}`,
        );
    const parsed = formatResponse.parse(
        await evaluateConfiguration({ ...request.data, tool: 'prettier', operation: 'format' }),
    );
    return compact({
        format: compact(parsed.format),
        ignorePatterns: parsed.ignorePatterns,
        extra: parsed.extra === undefined ? undefined : compact(parsed.extra),
    });
}

// Keep EditorConfig section order and directory ownership while validating representable properties.
function adoptEditorconfig(
    configs: ExistingTooling['configs'],
    observed: AdoptionResult['observed'],
): AdoptedFormatting['editorconfig'] {
    const editorconfigs = configs.filter(({ tool }) => tool === 'ec');
    if (editorconfigs.length === 0) return undefined;
    const editorconfig = editorconfigs.find(({ path }) => !path.includes('/'));
    const document = (path: string) => {
        const source = observed.get(path);
        if (source === undefined) throw new Error(`${path} was not observed in the repository.`);
        const sections = parseBuffer(source.bytes);
        return {
            preamble: sections.find(([glob]) => glob === null)?.[1] ?? {},
            sections: sections.filter(([glob]) => glob !== null).map(([glob, properties]) => ({ glob, properties })),
        };
    };
    return policySchema.shape.tools
        .unwrap()
        .shape.editorconfig.unwrap()
        .shape.adopted.unwrap()
        .parse({
            ...(editorconfig === undefined ? { preamble: {}, sections: [] } : document(editorconfig.path)),
            directories: editorconfigs
                .filter(({ path }) => path.includes('/'))
                .map(({ path }) => ({
                    basePath: dirname(path).replaceAll('\\', '/'),
                    ...document(path),
                })),
        });
}

/**
 * Convert observed formatter and EditorConfig settings before proposing retirement.
 * @param root the repository root
 * @param configs the formatter and EditorConfig files found
 * @param lists the carried configuration the settings are added to
 */
export async function collectFormatting(
    root: string,
    configs: ExistingTooling['configs'],
    lists: AdoptionResult,
): Promise<void> {
    const [first] = configs;
    if (first === undefined) return;
    try {
        const format = configs.filter(({ tool, carries }) => tool === 'prettier' && carries !== 'ignore-paths');
        const adopted = adoptEditorconfig(configs, lists.observed);
        const folders = new Set(format.map(({ path }) => dirname(path)));
        if (folders.size !== format.length)
            throw new Error('Multiple Prettier configurations in one directory require explicit conversion.');
        const sources = format.map((input) => {
            const observed = lists.observed.get(input.path);
            if (observed === undefined) throw new Error(`${input.path} was not observed in the repository.`);
            return {
                from: input.path,
                ...(/\.[cm]?[jt]s$/u.test(input.path) || /^package\./u.test(basename(input.path))
                    ? {}
                    : { source: parseConfigurationSource(observed, input.tool, input.path) }),
            };
        });
        lists.formatter = await adoptFormatting(
            root,
            sources,
            configs
                .filter(({ carries }) => carries === 'ignore-paths')
                .map(({ path }) => path)
                .toSorted(
                    (first, second) =>
                        first.split('/').length - second.split('/').length || first.localeCompare(second),
                ),
            adopted !== undefined,
        );
        if (adopted !== undefined) {
            lists.formatter.nativeDefaults = true;
            lists.formatter.editorconfig = adopted;
        }
        for (const { path } of configs) {
            if (/^package\./u.test(basename(path)))
                lists.retained.push({
                    path,
                    note: 'Package metadata retained; formatter options and selectors are represented in gspot configuration',
                });
            else
                lists.removed.push({
                    path,
                    note: 'Formatting options and ordered selectors are represented in gspot configuration',
                });
        }
    } catch (error) {
        lists.unread.push({ path: first.path, note: `not read and not deleted: ${(error as Error).message}` });
    }
}
