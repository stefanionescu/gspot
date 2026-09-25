import { configurationManifests } from '#cli/configurations/manifests.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';
import type { stylelintRequest } from '#cli/evaluation/protocol.ts';
import { stylelintResponse, stylelintSource } from '#cli/evaluation/protocol.ts';
import { carriedTool, reasonFor, type CarriedConfiguration } from '#cli/policy/adoption/results.ts';
import type { CarrySource } from '#cli/policy/adoption/source.ts';
import { observeConfiguration, parseCarrySource } from '#cli/policy/adoption/source.ts';
import { toolPin } from '#cli/tools/probe.ts';
import { extname, posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { z } from 'zod';

/**
 * Resolve static inheritance from observed files, retaining every input for publication-time validation.
 * @param root
 * @param path
 * @param source
 * @param lists
 */
function stylelintRules(
    root: string,
    path: string,
    source: CarrySource,
    lists: CarriedConfiguration,
): z.infer<typeof stylelintRequest>['rules'] {
    const visiting = new Set<string>();
    const resolve = (path: string, source: CarrySource): z.infer<typeof stylelintRequest>['rules'] => {
        if (visiting.has(path)) throw new Error(`${path}: Stylelint configuration inheritance contains a cycle.`);
        visiting.add(path);
        const configuration = stylelintSource.parse(source.parsed);
        let rules: z.infer<typeof stylelintRequest>['rules'] = {};
        for (const parent of [configuration.extends ?? []].flat()) {
            if ((!parent.startsWith('./') && !parent.startsWith('../')) || /[\\:]/u.test(parent))
                throw new Error(`${path}: inherited Stylelint configuration must use a repository-relative path.`);
            const target = posix.normalize(posix.join(posix.dirname(path), parent));
            if (!['.json', '.yaml', '.yml'].includes(extname(target)) && posix.basename(target) !== '.stylelintrc')
                throw new Error(`${path}: inherited Stylelint configuration requires static JSON or YAML.`);
            const original = lists.observed.get(target) ?? observeConfiguration(root, target).original;
            lists.observed.set(target, original);
            rules = { ...rules, ...resolve(target, parseCarrySource(original, 'stylelint', target)) };
        }
        visiting.delete(path);
        return { ...rules, ...configuration.rules };
    };
    return resolve(path, source);
}

/**
 * Validate the complete rule table before recording settings or authorizing retirement.
 * @param source
 * @param path
 * @param lists
 * @param root
 * @param check
 */
async function carryStylelint(
    source: CarrySource,
    path: string,
    lists: CarriedConfiguration,
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
    const carried = carriedTool(lists, 'stylelint');
    const base = posix.dirname(path);
    if (base === '.') carried.settings['rules'] = enabled;
    else {
        const scope = lists.scopes.get(base) ?? { configurations: [], tools: {} };
        scope.configurations = [...new Set([...scope.configurations, 'css'])];
        scope.tools['stylelint'] = { rules: enabled };
        lists.scopes.set(base, scope);
    }
    const paths = base === '.' ? undefined : [`${base.replaceAll(/[?*\[\]{}]/gu, String.raw`\$&`)}/**`];
    for (const rule of disabled)
        carried.ignores.push({ check, rule, reason: reasonFor(path), ...(paths === undefined ? {} : { paths }) });
}

export const stylelintImporter = { schema: stylelintSource, carry: carryStylelint };
