// @generated: bun scripts/setting-values.ts
import { z } from 'zod';
import { toolsSchema } from '#cli/policy/schema/tools.ts';
import { namingLists } from '#cli/parsers/schema/naming.ts';
import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';
import { allowlistSchema } from '#cli/parsers/schema/licenses.ts';

import {
    formatSchema,
    relativePath,
    architectureRolesSchema,
    environmentReadersSchema,
} from '#cli/policy/schema/contracts.ts';

export const settingNamespaceSchemas = {
    architecture: z.strictObject({
        modules: z
            .array(
                z.strictObject({
                    name: z.string(),
                    paths: z.array(relativePath),
                    may_import: z.array(z.string()).optional(),
                    reason: z.string().optional(),
                }),
            )
            .optional(),
        roles: z
            .strictObject({ roles: architectureRolesSchema })
            .shape['roles'].extend(
                z.strictObject({
                    routers: z.array(relativePath).optional(),
                    scripts: z.array(relativePath).optional(),
                    stores: z.array(relativePath).optional(),
                }).shape,
            )
            .optional(),
    }),
    cloudflare: z.strictObject({
        types_file: relativePath.meta({ pathRole: undefined }).optional(),
        types_interface: z.string().optional(),
    }),
    coverage: z.strictObject({
        branches: z.number().min(0, undefined).max(FULL_PERCENTAGE, undefined).optional(),
        functions: z.number().min(0, undefined).max(FULL_PERCENTAGE, undefined).optional(),
        lines: z.number().min(0, undefined).max(FULL_PERCENTAGE, undefined).optional(),
        overrides: z
            .array(
                z.strictObject({
                    target: z.string(),
                    percent: z.number().min(0, undefined).max(FULL_PERCENTAGE, undefined),
                }),
            )
            .optional(),
        statements: z.number().min(0, undefined).max(FULL_PERCENTAGE, undefined).optional(),
    }),
    dependencies: z.strictObject({
        min_release_age_days: z.number().optional(),
        registry_hosts: z.object({ registry_hosts: z.array(z.string().min(1)) }).shape['registry_hosts'].optional(),
        scanner: z.string().optional(),
    }),
    docs: z.strictObject({ banned_headings: z.array(z.string()).optional(), require_license: z.boolean().optional() }),
    drizzle: z.strictObject({ client_names: z.array(z.string()).optional() }),
    format: z.strictObject({
        final_newline: formatSchema.shape['final_newline'].unwrap().optional(),
        indent_style: formatSchema.shape['indent_style'].unwrap().optional(),
        indent_width: formatSchema.shape['indent_width'].unwrap().optional(),
        line_ending: formatSchema.shape['line_ending'].unwrap().optional(),
        overrides: formatSchema.shape['overrides'].unwrap().optional(),
        print_width: formatSchema.shape['print_width'].unwrap().optional(),
        quotes: formatSchema.shape['quotes'].unwrap().optional(),
        semicolons: formatSchema.shape['semicolons'].unwrap().optional(),
        trailing_commas: formatSchema.shape['trailing_commas'].unwrap().optional(),
    }),
    html: z.strictObject({ templates: z.array(relativePath).optional() }),
    licenses: z.strictObject({
        allowed: allowlistSchema.shape['allowed'].optional(),
        exceptions: allowlistSchema.shape['exceptions'].optional(),
    }),
    limits: z.strictObject({
        callback_nesting: z.number().optional(),
        cognitive_complexity: z.number().optional(),
        cyclomatic_complexity: z.number().optional(),
        file_kb: z.number().optional(),
        file_lines: z.number().optional(),
        function_lines: z.number().optional(),
        function_parameters: z.number().optional(),
        index_exports: z.number().optional(),
        min_function_statements: z
            .number()
            .int('Use a whole number of statements, 1 or more.')
            .min(1, 'Use a whole number of statements, 1 or more.')
            .optional(),
        nesting: z.number().optional(),
        prefix_collisions: z.number().optional(),
        statements: z.number().optional(),
        bash: z
            .strictObject({
                assignments: z.number().optional(),
                branches: z.number().optional(),
                file_lines: z.number().optional(),
                function_lines: z.number().optional(),
                nesting: z.number().optional(),
            })
            .optional(),
        docs: z
            .strictObject({
                headings_before_contents: z.number().optional(),
                list_item_words: z.number().optional(),
                paragraph_sentences: z.number().optional(),
                sentence_words: z.number().optional(),
            })
            .optional(),
        duplication: z
            .strictObject({
                min_lines: z.number().optional(),
                min_tokens: z.number().optional(),
                percent: z.number().optional(),
            })
            .optional(),
        python: z.strictObject({ branches: z.number().optional(), returns: z.number().optional() }).optional(),
        sql: z.strictObject({ file_lines: z.number().optional() }).optional(),
        swift: z.strictObject({ closure_lines: z.number().optional(), type_lines: z.number().optional() }).optional(),
    }),
    links: z.strictObject({ allowed_urls: z.array(z.string()).optional() }),
    naming: z.strictObject({
        allowed: namingLists.shape['allowed'].unwrap().optional(),
        banned: namingLists.shape['banned'].unwrap().optional(),
        case: z.array(z.string()).optional(),
        max_chars: z.number().optional(),
        max_words: z.number().optional(),
        reserved: namingLists.shape['reserved'].unwrap().optional(),
        sql: z.strictObject({ max_chars: z.number().optional(), max_words: z.number().optional() }).optional(),
        swift: z.strictObject({ max_chars: z.number().optional(), max_words: z.number().optional() }).optional(),
    }),
    openapi: z.strictObject({
        document: z.union([z.literal(''), relativePath]).optional(),
        generate_command: z.array(z.string()).optional(),
    }),
    postgres: z.strictObject({
        client_schemas: z.array(z.string()).optional(),
        doc_sections: z.array(z.string()).optional(),
        frozen_through: z.string().optional(),
        migrations_folder: z.string().optional(),
    }),
    prose: z.strictObject({
        locale: z
            .string()
            .and(z.literal(['en', 'en-us', 'en-gb', 'en-ca', 'en-au'], {}))
            .optional(),
    }),
    secrets: z.strictObject({
        env_examples: z.array(relativePath).optional(),
        reader_functions: z
            .strictObject({ reader_functions: environmentReadersSchema })
            .shape['reader_functions'].optional(),
    }),
    site: z.strictObject({
        build_command: z.array(z.string()).optional(),
        build_folder: relativePath.meta({ pathRole: 'destination' }).optional(),
        max_kilobytes: z
            .array(z.strictObject({ paths: z.array(z.string()), kb: z.number().int(undefined).min(0, undefined) }))
            .optional(),
        sitemap_exclude: z.array(z.string()).optional(),
    }),
    structure: z.strictObject({
        reexports: z
            .string()
            .and(z.literal(['none', 'index-only'], {}))
            .optional(),
    }),
    supabase: z.strictObject({
        functions_folder: relativePath.optional(),
        schemas: z.array(z.string()).optional(),
        types_file: z.union([z.literal(''), relativePath.meta({ pathRole: 'destination' })]).optional(),
    }),
    swift: z.strictObject({
        xcode_destination: z.string().optional(),
        xcode_project: z.union([z.literal(''), relativePath]).optional(),
        xcode_scheme: z.string().optional(),
    }),
    'tools.codeql': z.strictObject({
        languages: z.array(relativePath.meta({ pathRole: undefined })).optional(),
        suite: z
            .string()
            .and(z.literal(['security-extended', 'security-and-quality'], {}))
            .optional(),
    }),
    'tools.commitlint': z.strictObject({
        rules: toolsSchema.shape['commitlint'].unwrap().shape['rules'].unwrap().optional(),
        scopes: toolsSchema.shape['commitlint'].unwrap().shape['scopes'].unwrap().optional(),
        types: toolsSchema.shape['commitlint'].unwrap().shape['types'].unwrap().optional(),
    }),
    'tools.eslint': z.strictObject({
        import_extensions: toolsSchema.shape['eslint'].unwrap().shape['import_extensions'].unwrap().optional(),
        node_version: z.string().optional(),
        overrides: toolsSchema.shape['eslint'].unwrap().shape['overrides'].unwrap().optional(),
        restricted_imports: z.array(z.strictObject({ name: z.string(), message: z.string() })).optional(),
        rules: toolsSchema.shape['eslint'].unwrap().shape['rules'].unwrap().optional(),
        runtimes: toolsSchema.shape['eslint'].unwrap().shape['runtimes'].unwrap().optional(),
    }),
    'tools.hadolint': z.strictObject({ trusted_registries: z.array(z.string()).optional() }),
    'tools.knip': z.strictObject({
        entry: z.array(relativePath).optional(),
        ignore_dependencies: toolsSchema.shape['knip'].unwrap().shape['ignore_dependencies'].unwrap().optional(),
    }),
    'tools.markdownlint': z.strictObject({
        rules: toolsSchema.shape['markdownlint'].unwrap().shape['rules'].unwrap().optional(),
    }),
    'tools.nginx': z.strictObject({ image: z.string().optional() }),
    'tools.purgecss': z.strictObject({
        safelist: toolsSchema.shape['purgecss'].unwrap().shape['safelist'].unwrap().optional(),
    }),
    'tools.ruff': z.strictObject({
        docstring_convention: z
            .string()
            .and(z.literal(['', 'google', 'numpy', 'pep257'], {}))
            .optional(),
    }),
    'tools.semgrep': z.strictObject({
        registry: z.array(z.string()).optional(),
        rule_files: z.array(relativePath).optional(),
    }),
    'tools.sqlfluff': z.strictObject({
        dialect: z
            .string()
            .regex(/^[a-z][a-z0-9_]*$/u, 'Use a SQLFluff dialect label, such as postgres or sqlite.')
            .optional(),
    }),
    'tools.squawk': z.strictObject({
        assume_in_transaction: toolsSchema.shape['squawk'].unwrap().shape['assume_in_transaction'].unwrap().optional(),
    }),
    'tools.stylelint': z.strictObject({
        rules: toolsSchema.shape['stylelint'].unwrap().shape['rules'].unwrap().optional(),
    }),
    'tools.svgo': z.strictObject({
        min_saving_percent: z.number().min(0, undefined).max(FULL_PERCENTAGE, undefined).optional(),
    }),
    'tools.swiftlint': z.strictObject({ keep_imports: z.array(z.string()).optional() }),
    'tools.trivy': z.strictObject({ severity: z.array(z.string()).optional() }),
    'tools.v8r': z.strictObject({ schemas: toolsSchema.shape['v8r'].unwrap().shape['schemas'].unwrap().optional() }),
    'tools.yamllint': z.strictObject({
        rules: toolsSchema.shape['yamllint'].unwrap().shape['rules'].unwrap().optional(),
    }),
    translations: z.strictObject({
        base_locale: z.string().optional(),
        messages_folder: z.union([z.literal(''), relativePath]).optional(),
    }),
    xcode: z.strictObject({ entitlements_allowed: z.array(z.string()).optional() }),
};
export const publicToolsSchema = z.strictObject({
    codeql: settingNamespaceSchemas['tools.codeql'].optional(),
    commitlint: toolsSchema.shape['commitlint'],
    'editorconfig-checker': toolsSchema.shape['editorconfig-checker'],
    eslint: toolsSchema.shape['eslint'].unwrap().extend(settingNamespaceSchemas['tools.eslint'].shape).optional(),
    hadolint: settingNamespaceSchemas['tools.hadolint'].optional(),
    knip: toolsSchema.shape['knip'].unwrap().extend(settingNamespaceSchemas['tools.knip'].shape).optional(),
    lychee: toolsSchema.shape['lychee'],
    markdownlint: toolsSchema.shape['markdownlint'],
    nginx: settingNamespaceSchemas['tools.nginx'].optional(),
    prettier: toolsSchema.shape['prettier'],
    purgecss: toolsSchema.shape['purgecss'],
    ruff: settingNamespaceSchemas['tools.ruff'].optional(),
    semgrep: settingNamespaceSchemas['tools.semgrep'].optional(),
    shellcheck: toolsSchema.shape['shellcheck'],
    sqlfluff: settingNamespaceSchemas['tools.sqlfluff'].optional(),
    squawk: toolsSchema.shape['squawk'],
    stylelint: toolsSchema.shape['stylelint'],
    svgo: settingNamespaceSchemas['tools.svgo'].optional(),
    swiftlint: settingNamespaceSchemas['tools.swiftlint'].optional(),
    taplo: toolsSchema.shape['taplo'],
    trivy: settingNamespaceSchemas['tools.trivy'].optional(),
    typos: toolsSchema.shape['typos'],
    v8r: toolsSchema.shape['v8r'],
    yamllint: toolsSchema.shape['yamllint'],
});
export const configurationSettingSchemas = {
    cloudflare: settingNamespaceSchemas['cloudflare'].optional(),
    coverage: settingNamespaceSchemas['coverage'].optional(),
    dependencies: settingNamespaceSchemas['dependencies'].optional(),
    docs: settingNamespaceSchemas['docs'].optional(),
    drizzle: settingNamespaceSchemas['drizzle'].optional(),
    html: settingNamespaceSchemas['html'].optional(),
    licenses: settingNamespaceSchemas['licenses'].optional(),
    links: settingNamespaceSchemas['links'].optional(),
    openapi: settingNamespaceSchemas['openapi'].optional(),
    postgres: settingNamespaceSchemas['postgres'].optional(),
    prose: settingNamespaceSchemas['prose'].optional(),
    secrets: settingNamespaceSchemas['secrets'].optional(),
    site: settingNamespaceSchemas['site'].optional(),
    supabase: settingNamespaceSchemas['supabase'].optional(),
    swift: settingNamespaceSchemas['swift'].optional(),
    translations: settingNamespaceSchemas['translations'].optional(),
    xcode: settingNamespaceSchemas['xcode'].optional(),
};
