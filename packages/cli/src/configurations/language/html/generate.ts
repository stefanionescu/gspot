import { HTML_VALIDATE_EXTENDS, HTML_VALIDATE_RULES } from '#cli/config/configurations/html.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

const GENERATED_MARKUP_PACKAGES: ReadonlySet<string> = new Set([
    '@astrojs/starlight',
    'astro-expressive-code',
    'expressive-code',
]);

const GENERATED_MARKUP_RULES = [
    'element-permitted-content',
    'no-implicit-button-type',
    'text-content',
    'unique-landmark',
] as const;

/**
Build html-validate.json: the HTML validation rules for source files or built site pages. A site built with Starlight
or Expressive Code leaves out the rules that report the markup those packages write, which the user does not write.
*/
export function buildHtmlValidateFile(planned: PlannedConfig): string {
    const configuration = planned.configuration.name;
    const dependencies = listProjectDependencyNames(planned.session.repository.dependencyFiles, planned.scope.path);
    const isGeneratedMarkup =
        configuration === 'site' && dependencies.some((name) => GENERATED_MARKUP_PACKAGES.has(name));
    const rules: Record<string, unknown> = { ...HTML_VALIDATE_RULES[configuration] };
    for (const rule of [...listDisabledRules(planned), ...(isGeneratedMarkup ? GENERATED_MARKUP_RULES : [])])
        rules[rule] = 'off';
    return JSON.stringify({ extends: HTML_VALIDATE_EXTENDS, rules }, null, JSON_INDENT);
}

export const HTML_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'html/html-validate.json': buildHtmlValidateFile,
};
