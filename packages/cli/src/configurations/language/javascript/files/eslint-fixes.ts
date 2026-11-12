import { createRequire } from 'node:module';

import type {
    EslintRuleContext,
    EslintRuleModule,
    EslintRuleReport,
    EslintUnicornPlugin,
} from '#cli/types/configurations/javascript.ts';

// ESLint freezes the context of a rule, so the rule gets a stand-in that forwards every other member to it.
function changeReports(
    rule: EslintRuleModule,
    change: (report: EslintRuleReport, context: EslintRuleContext) => EslintRuleReport,
): EslintRuleModule {
    return {
        ...rule,
        create(context) {
            const changed = new Proxy(
                {
                    options: context.options,
                    report: (finding: EslintRuleReport) => {
                        context.report(change(finding, context));
                    },
                },
                {
                    get(target, key) {
                        if (key === 'report') return target.report;
                        const member: unknown = Reflect.get(context, key, context);
                        return typeof member === 'function' ? (member.bind(context) as unknown) : member;
                    },
                },
            );
            return rule.create(changed);
        },
    };
}

// The fix puts the first prefix before the name. After a prefix that the options turn off, such as `was`, the new
// name reads wrong and the rule accepts it, so the finding stays for a rename by hand.
function dropPrefixedRename(report: EslintRuleReport, context: EslintRuleContext): EslintRuleReport {
    const prefixes = (context.options[0] as { prefixes?: Record<string, boolean> } | undefined)?.prefixes;
    if (prefixes === undefined) return report;
    const name = String(report.data?.['name']).replace(/^_+/u, '');
    const hasPrefix = Object.keys(prefixes).some(
        (prefix) =>
            prefixes[prefix] === false &&
            (name.startsWith(`${prefix.toUpperCase()}_`) ||
                (name.startsWith(prefix) && /^[\dA-Z_]/u.test(name.slice(prefix.length)))),
    );
    if (!hasPrefix) return report;
    const { fix: _fix, ...finding } = report;
    return finding;
}

// The fix of an indented comment leaves the indentation on each line that held only an asterisk, and no formatter
// changes the text of a comment.
function trimBlankLines(report: EslintRuleReport): EslintRuleReport {
    return {
        ...report,
        fix: (fixer) =>
            report.fix?.(fixer)?.map((edit) => ({ ...edit, text: edit.text.replaceAll(/^[\t ]+$/gmu, '') })),
    };
}

/**
Read eslint-plugin-unicorn from the generated tool project, and keep two of its fixes from writing text that no check
reports afterwards: a boolean name with two prefixes, and a line of spaces in a documentation comment. Each finding
stays. Its presets name the returned plugin, because ESLint refuses two objects under one prefix.
*/
export function limitUnicornFixes(): EslintUnicornPlugin {
    const module: unknown = createRequire(import.meta.url)('eslint-plugin-unicorn');
    const plugin = (
        typeof module === 'object' && module !== null && 'default' in module ? module.default : module
    ) as EslintUnicornPlugin;
    const limited: EslintUnicornPlugin = {
        ...plugin,
        rules: {
            ...plugin.rules,
            'consistent-boolean-name': changeReports(plugin.rules['consistent-boolean-name'], dropPrefixedRename),
            'no-asterisk-prefix-in-documentation-comments': changeReports(
                plugin.rules['no-asterisk-prefix-in-documentation-comments'],
                trimBlankLines,
            ),
        },
    };
    limited.configs = Object.fromEntries(
        Object.entries(plugin.configs).map(([name, config]) => [
            name,
            { ...config, plugins: { ...config.plugins, unicorn: limited } },
        ]),
    );
    return limited;
}
