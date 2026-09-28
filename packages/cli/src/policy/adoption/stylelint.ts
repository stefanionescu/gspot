import { z } from 'zod';
import { posix, extname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { toolPin } from '#cli/tools/inspect.ts';
import type { stylelintRequest } from '#cli/evaluation/protocol.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { stylelintSource, stylelintResponse } from '#cli/evaluation/protocol.ts';
import { reasonFor, adoptedTool, adoptedScope } from '#cli/policy/adoption/results.ts';
import type { AdoptionResult, ConfigurationSource } from '#cli/types/policy/adoption.ts';
import { observeConfiguration, parseConfigurationSource } from '#cli/policy/adoption/source.ts';

/**
 * Resolve static inheritance from observed files, retaining every input for publication-time validation.
 * @param root the repository root
 * @param path the authored Stylelint file
 * @param source the file, read and parsed
 * @param lists the carried configuration that records every file read
 * @returns the complete rule table after inheritance
 */
function stylelintRules(
    root: string,
    path: string,
    source: ConfigurationSource,
    lists: AdoptionResult,
): z.infer<typeof stylelintRequest>['rules'] {
    const visiting = new Set<string>();
    const inheritedRules = (path: string, source: ConfigurationSource): z.infer<typeof stylelintRequest>['rules'] => {
        if (visiting.has(path)) throw new Error(`${path}: Stylelint configuration inheritance contains a cycle.`);
        visiting.add(path);
        const configuration = stylelintSource.parse(source.parsed);
        let rules: z.infer<typeof stylelintRequest>['rules'] = {};
        for (const parent of [configuration.extends ?? []].flat()) {
            if (!/^\.\.?\/[^\\:]*$/u.test(parent))
                throw new Error(`${path}: inherited Stylelint configuration must use a repository-relative path.`);
            const target = posix.normalize(posix.join(posix.dirname(path), parent));
            if (!['.json', '.yaml', '.yml'].includes(extname(target)) && posix.basename(target) !== '.stylelintrc')
                throw new Error(`${path}: inherited Stylelint configuration requires static JSON or YAML.`);
            const original = lists.observed.get(target) ?? observeConfiguration(root, target).original;
            lists.observed.set(target, original);
            rules = { ...rules, ...inheritedRules(target, parseConfigurationSource(original, 'stylelint', target)) };
        }
        visiting.delete(path);
        return { ...rules, ...configuration.rules };
    };
    return inheritedRules(path, source);
}

/**
 * Validate the complete rule table before recording settings or authorizing retirement.
 * @param source the file, read and parsed
 * @param path the authored Stylelint file
 * @param lists the carried configuration
 * @param root the repository root
 * @param check the check the carried ignores belong to
 */
async function carryStylelint(
    source: ConfigurationSource,
    path: string,
    lists: AdoptionResult,
    root: string,
    check?: string,
): Promise<void> {
    if (check === undefined) throw new Error(`${path}: Stylelint adoption requires its declared destination check.`);
    const rules = stylelintRules(root, path, source, lists);
    const disabled = new Set(
        Object.entries(rules)
            .filter(([, value]) => (Array.isArray(value) ? value[0] : value) === null)
            .map(([rule]) => rule),
    );
    const enabled = Object.fromEntries(Object.entries(rules).filter(([rule]) => !disabled.has(rule)));
    const converted = parseToml(stringifyToml({ rules: enabled }));
    if (!isDeepStrictEqual(converted['rules'], enabled))
        throw new Error(`${path}: Stylelint rule options cannot be represented without loss in TOML.`);
    const version = z.string().min(1).parse(toolPin(configurationManifests().values(), 'stylelint').version);
    stylelintResponse.parse(
        await evaluateConfiguration({ root, tool: 'stylelint', operation: 'stylelint', version, rules }),
    );
    const carried = adoptedTool(lists, 'stylelint');
    const base = posix.dirname(path);
    if (base === '.') carried.settings['rules'] = enabled;
    else {
        const scope = adoptedScope(lists, base, 'css');
        scope.tools['stylelint'] = { rules: enabled };
    }
    const literalBase = base.replaceAll(/[?*[\]{}]/gu, String.raw`\$&`);
    const paths = base === '.' ? undefined : [`${literalBase}/**`];
    for (const rule of disabled)
        carried.ignores.push({ check, rule, reason: reasonFor(path), ...(paths === undefined ? {} : { paths }) });
}

export const stylelintImporter = { schema: stylelintSource, carry: carryStylelint };
