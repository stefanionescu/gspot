// @generated: bun scripts/setting-values.ts
import { z } from 'zod';
import { settingNamespaceSchemas } from '#cli/policy/schema/native/contracts.ts';

export const namingSettingSchemas = {
    max_chars: z.object({
        'typescript.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'typescript.files.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'typescript.directories.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'typescript.types.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'typescript.functions.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'typescript.parameters.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'typescript.variables.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'typescript.properties.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.files.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.directories.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.types.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.functions.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.parameters.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.variables.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'javascript.properties.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.files.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.directories.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.types.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.functions.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.parameters.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.variables.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'python.properties.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.files.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.directories.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.types.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.functions.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.parameters.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.variables.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'bash.properties.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap().optional(),
        'swift.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'swift.files.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'swift.directories.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'swift.types.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'swift.functions.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'swift.parameters.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'swift.variables.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'swift.properties.max_chars': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'sql.max_chars': settingNamespaceSchemas['naming'].shape['sql'].unwrap().shape['max_chars'].unwrap().optional(),
        'sql.files.max_chars': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'sql.directories.max_chars': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'sql.types.max_chars': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'sql.functions.max_chars': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'sql.parameters.max_chars': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'sql.variables.max_chars': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
        'sql.properties.max_chars': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_chars'].unwrap()
            .optional(),
    }),
    max_words: z.object({
        'typescript.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'typescript.files.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'typescript.directories.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'typescript.types.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'typescript.functions.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'typescript.parameters.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'typescript.variables.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'typescript.properties.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.files.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.directories.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.types.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.functions.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.parameters.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.variables.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'javascript.properties.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.files.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.directories.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.types.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.functions.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.parameters.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.variables.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'python.properties.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.files.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.directories.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.types.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.functions.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.parameters.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.variables.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'bash.properties.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap().optional(),
        'swift.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'swift.files.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'swift.directories.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'swift.types.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'swift.functions.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'swift.parameters.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'swift.variables.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'swift.properties.max_words': settingNamespaceSchemas['naming'].shape['swift']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'sql.max_words': settingNamespaceSchemas['naming'].shape['sql'].unwrap().shape['max_words'].unwrap().optional(),
        'sql.files.max_words': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'sql.directories.max_words': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'sql.types.max_words': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'sql.functions.max_words': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'sql.parameters.max_words': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'sql.variables.max_words': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
        'sql.properties.max_words': settingNamespaceSchemas['naming'].shape['sql']
            .unwrap()
            .shape['max_words'].unwrap()
            .optional(),
    }),
    case: z.object({
        'typescript.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'typescript.files.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'typescript.directories.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'typescript.types.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'typescript.functions.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'typescript.parameters.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'typescript.variables.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'typescript.properties.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.files.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.directories.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.types.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.functions.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.parameters.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.variables.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'javascript.properties.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.files.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.directories.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.types.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.functions.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.parameters.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.variables.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'python.properties.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.files.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.directories.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.types.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.functions.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.parameters.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.variables.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'swift.properties.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.files.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.directories.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.types.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.functions.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.parameters.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.variables.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'bash.properties.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.files.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.directories.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.types.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.functions.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.parameters.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.variables.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
        'sql.properties.case': settingNamespaceSchemas['naming'].shape['case'].unwrap().optional(),
    }),
};
export const namingSettingKeys = {
    max_chars: namingSettingSchemas['max_chars'].keyof().options,
    max_words: namingSettingSchemas['max_words'].keyof().options,
    case: namingSettingSchemas['case'].keyof().options,
};
export const activeSettingNamespaceSchemas = {
    architecture: settingNamespaceSchemas['architecture'].required({ roles: true, modules: true }),
    cloudflare: settingNamespaceSchemas['cloudflare'].required({ types_file: true, types_interface: true }),
    coverage: settingNamespaceSchemas['coverage'].required({
        lines: true,
        branches: true,
        functions: true,
        statements: true,
        overrides: true,
    }),
    dependencies: settingNamespaceSchemas['dependencies'].required({
        min_release_age_days: true,
        scanner: true,
        registry_hosts: true,
    }),
    docs: settingNamespaceSchemas['docs'].required({ banned_headings: true, require_license: true }),
    drizzle: settingNamespaceSchemas['drizzle'].required({ client_names: true }),
    format: settingNamespaceSchemas['format'].required({
        indent_style: true,
        indent_width: true,
        print_width: true,
        line_ending: true,
        final_newline: true,
        quotes: true,
        trailing_commas: true,
        semicolons: true,
        overrides: true,
    }),
    html: settingNamespaceSchemas['html'].required({ templates: true }),
    licenses: settingNamespaceSchemas['licenses'].required({ allowed: true, exceptions: true }),
    limits: settingNamespaceSchemas['limits']
        .required({
            file_kb: true,
            file_lines: true,
            function_lines: true,
            function_parameters: true,
            cognitive_complexity: true,
            cyclomatic_complexity: true,
            nesting: true,
            statements: true,
            callback_nesting: true,
            index_exports: true,
            prefix_collisions: true,
            min_function_statements: true,
        })
        .extend({
            docs: settingNamespaceSchemas['limits'].shape['docs'].unwrap().required({
                headings_before_contents: true,
                sentence_words: true,
                list_item_words: true,
                paragraph_sentences: true,
            }),
            duplication: settingNamespaceSchemas['limits'].shape['duplication']
                .unwrap()
                .required({ min_lines: true, min_tokens: true, percent: true }),
            python: settingNamespaceSchemas['limits'].shape['python']
                .unwrap()
                .required({ branches: true, returns: true }),
            bash: settingNamespaceSchemas['limits'].shape['bash']
                .unwrap()
                .required({ file_lines: true, function_lines: true, branches: true, nesting: true, assignments: true }),
            swift: settingNamespaceSchemas['limits'].shape['swift']
                .unwrap()
                .required({ type_lines: true, closure_lines: true }),
        }),
    links: settingNamespaceSchemas['links'].required({ allowed_urls: true }),
    naming: settingNamespaceSchemas['naming']
        .required({ banned: true, allowed: true, reserved: true, max_chars: true, max_words: true, case: true })
        .extend({
            swift: settingNamespaceSchemas['naming'].shape['swift']
                .unwrap()
                .required({ max_chars: true, max_words: true }),
            sql: settingNamespaceSchemas['naming'].shape['sql'].unwrap().required({ max_chars: true, max_words: true }),
        })
        .extend({
            ...namingSettingSchemas['max_chars'].shape,
            ...namingSettingSchemas['max_words'].shape,
            ...namingSettingSchemas['case'].shape,
        }),
    openapi: settingNamespaceSchemas['openapi'].required({ document: true, generate_command: true }),
    postgres: settingNamespaceSchemas['postgres'].required({
        frozen_through: true,
        migrations_folder: true,
        client_schemas: true,
        doc_sections: true,
    }),
    prose: settingNamespaceSchemas['prose'].required({ locale: true }),
    secrets: settingNamespaceSchemas['secrets'].required({ env_examples: true, reader_functions: true }),
    site: settingNamespaceSchemas['site'].required({
        build_command: true,
        build_folder: true,
        max_kilobytes: true,
        sitemap_exclude: true,
    }),
    structure: settingNamespaceSchemas['structure'].required({ reexports: true }),
    supabase: settingNamespaceSchemas['supabase'].required({ schemas: true, types_file: true, functions_folder: true }),
    swift: settingNamespaceSchemas['swift'].required({
        xcode_project: true,
        xcode_scheme: true,
        xcode_destination: true,
    }),
    'tools.codeql': settingNamespaceSchemas['tools.codeql'].required({ languages: true, suite: true }),
    'tools.commitlint': settingNamespaceSchemas['tools.commitlint'].required({
        types: true,
        scopes: true,
        rules: true,
    }),
    'tools.eslint': settingNamespaceSchemas['tools.eslint'].required({
        rules: true,
        overrides: true,
        import_extensions: true,
        runtimes: true,
        node_version: true,
        restricted_imports: true,
    }),
    'tools.hadolint': settingNamespaceSchemas['tools.hadolint'].required({ trusted_registries: true }),
    'tools.knip': settingNamespaceSchemas['tools.knip'].required({ entry: true, ignore_dependencies: true }),
    'tools.markdownlint': settingNamespaceSchemas['tools.markdownlint'].required({ rules: true }),
    'tools.nginx': settingNamespaceSchemas['tools.nginx'].required({ image: true }),
    'tools.purgecss': settingNamespaceSchemas['tools.purgecss'].required({ safelist: true }),
    'tools.ruff': settingNamespaceSchemas['tools.ruff'].required({ docstring_convention: true }),
    'tools.semgrep': settingNamespaceSchemas['tools.semgrep'].required({ rule_files: true, registry: true }),
    'tools.sqlfluff': settingNamespaceSchemas['tools.sqlfluff'].required({ dialect: true }),
    'tools.squawk': settingNamespaceSchemas['tools.squawk'].required({ assume_in_transaction: true }),
    'tools.stylelint': settingNamespaceSchemas['tools.stylelint'].required({ rules: true }),
    'tools.svgo': settingNamespaceSchemas['tools.svgo'].required({ min_saving_percent: true }),
    'tools.swiftlint': settingNamespaceSchemas['tools.swiftlint'].required({ keep_imports: true }),
    'tools.trivy': settingNamespaceSchemas['tools.trivy'].required({ severity: true }),
    'tools.v8r': settingNamespaceSchemas['tools.v8r'].required({ schemas: true }),
    'tools.yamllint': settingNamespaceSchemas['tools.yamllint'].required({ rules: true }),
    translations: settingNamespaceSchemas['translations'].required({ messages_folder: true, base_locale: true }),
    xcode: settingNamespaceSchemas['xcode'].required({ entitlements_allowed: true }),
};
export const activeSettingNamespacesSchema = z.strictObject(activeSettingNamespaceSchemas).partial();
export const settingValueSchemas = {
    'architecture.modules': settingNamespaceSchemas['architecture'].shape['modules'].unwrap(),
    'architecture.roles': settingNamespaceSchemas['architecture'].shape['roles'].unwrap(),
    'architecture.roles.routers': settingNamespaceSchemas['architecture'].shape['roles']
        .unwrap()
        .shape['routers'].unwrap(),
    'architecture.roles.scripts': settingNamespaceSchemas['architecture'].shape['roles']
        .unwrap()
        .shape['scripts'].unwrap(),
    'architecture.roles.stores': settingNamespaceSchemas['architecture'].shape['roles']
        .unwrap()
        .shape['stores'].unwrap(),
    'cloudflare.types_file': settingNamespaceSchemas['cloudflare'].shape['types_file'].unwrap(),
    'cloudflare.types_interface': settingNamespaceSchemas['cloudflare'].shape['types_interface'].unwrap(),
    'coverage.branches': settingNamespaceSchemas['coverage'].shape['branches'].unwrap(),
    'coverage.functions': settingNamespaceSchemas['coverage'].shape['functions'].unwrap(),
    'coverage.lines': settingNamespaceSchemas['coverage'].shape['lines'].unwrap(),
    'coverage.overrides': settingNamespaceSchemas['coverage'].shape['overrides'].unwrap(),
    'coverage.statements': settingNamespaceSchemas['coverage'].shape['statements'].unwrap(),
    'dependencies.min_release_age_days': settingNamespaceSchemas['dependencies'].shape['min_release_age_days'].unwrap(),
    'dependencies.registry_hosts': settingNamespaceSchemas['dependencies'].shape['registry_hosts'].unwrap(),
    'dependencies.scanner': settingNamespaceSchemas['dependencies'].shape['scanner'].unwrap(),
    'docs.banned_headings': settingNamespaceSchemas['docs'].shape['banned_headings'].unwrap(),
    'docs.require_license': settingNamespaceSchemas['docs'].shape['require_license'].unwrap(),
    'drizzle.client_names': settingNamespaceSchemas['drizzle'].shape['client_names'].unwrap(),
    'format.final_newline': settingNamespaceSchemas['format'].shape['final_newline'].unwrap(),
    'format.indent_style': settingNamespaceSchemas['format'].shape['indent_style'].unwrap(),
    'format.indent_width': settingNamespaceSchemas['format'].shape['indent_width'].unwrap(),
    'format.line_ending': settingNamespaceSchemas['format'].shape['line_ending'].unwrap(),
    'format.overrides': settingNamespaceSchemas['format'].shape['overrides'].unwrap(),
    'format.print_width': settingNamespaceSchemas['format'].shape['print_width'].unwrap(),
    'format.quotes': settingNamespaceSchemas['format'].shape['quotes'].unwrap(),
    'format.semicolons': settingNamespaceSchemas['format'].shape['semicolons'].unwrap(),
    'format.trailing_commas': settingNamespaceSchemas['format'].shape['trailing_commas'].unwrap(),
    'html.templates': settingNamespaceSchemas['html'].shape['templates'].unwrap(),
    'licenses.allowed': settingNamespaceSchemas['licenses'].shape['allowed'].unwrap(),
    'licenses.exceptions': settingNamespaceSchemas['licenses'].shape['exceptions'].unwrap(),
    'limits.bash.assignments': settingNamespaceSchemas['limits'].shape['bash'].unwrap().shape['assignments'].unwrap(),
    'limits.bash.branches': settingNamespaceSchemas['limits'].shape['bash'].unwrap().shape['branches'].unwrap(),
    'limits.bash.file_lines': settingNamespaceSchemas['limits'].shape['bash'].unwrap().shape['file_lines'].unwrap(),
    'limits.bash.function_lines': settingNamespaceSchemas['limits'].shape['bash']
        .unwrap()
        .shape['function_lines'].unwrap(),
    'limits.bash.nesting': settingNamespaceSchemas['limits'].shape['bash'].unwrap().shape['nesting'].unwrap(),
    'limits.callback_nesting': settingNamespaceSchemas['limits'].shape['callback_nesting'].unwrap(),
    'limits.cognitive_complexity': settingNamespaceSchemas['limits'].shape['cognitive_complexity'].unwrap(),
    'limits.cyclomatic_complexity': settingNamespaceSchemas['limits'].shape['cyclomatic_complexity'].unwrap(),
    'limits.docs.headings_before_contents': settingNamespaceSchemas['limits'].shape['docs']
        .unwrap()
        .shape['headings_before_contents'].unwrap(),
    'limits.docs.list_item_words': settingNamespaceSchemas['limits'].shape['docs']
        .unwrap()
        .shape['list_item_words'].unwrap(),
    'limits.docs.paragraph_sentences': settingNamespaceSchemas['limits'].shape['docs']
        .unwrap()
        .shape['paragraph_sentences'].unwrap(),
    'limits.docs.sentence_words': settingNamespaceSchemas['limits'].shape['docs']
        .unwrap()
        .shape['sentence_words'].unwrap(),
    'limits.duplication.min_lines': settingNamespaceSchemas['limits'].shape['duplication']
        .unwrap()
        .shape['min_lines'].unwrap(),
    'limits.duplication.min_tokens': settingNamespaceSchemas['limits'].shape['duplication']
        .unwrap()
        .shape['min_tokens'].unwrap(),
    'limits.duplication.percent': settingNamespaceSchemas['limits'].shape['duplication']
        .unwrap()
        .shape['percent'].unwrap(),
    'limits.file_kb': settingNamespaceSchemas['limits'].shape['file_kb'].unwrap(),
    'limits.file_lines': settingNamespaceSchemas['limits'].shape['file_lines'].unwrap(),
    'limits.function_lines': settingNamespaceSchemas['limits'].shape['function_lines'].unwrap(),
    'limits.function_parameters': settingNamespaceSchemas['limits'].shape['function_parameters'].unwrap(),
    'limits.index_exports': settingNamespaceSchemas['limits'].shape['index_exports'].unwrap(),
    'limits.min_function_statements': settingNamespaceSchemas['limits'].shape['min_function_statements'].unwrap(),
    'limits.nesting': settingNamespaceSchemas['limits'].shape['nesting'].unwrap(),
    'limits.prefix_collisions': settingNamespaceSchemas['limits'].shape['prefix_collisions'].unwrap(),
    'limits.python.branches': settingNamespaceSchemas['limits'].shape['python'].unwrap().shape['branches'].unwrap(),
    'limits.python.returns': settingNamespaceSchemas['limits'].shape['python'].unwrap().shape['returns'].unwrap(),
    'limits.sql.file_lines': settingNamespaceSchemas['limits'].shape['sql'].unwrap().shape['file_lines'].unwrap(),
    'limits.statements': settingNamespaceSchemas['limits'].shape['statements'].unwrap(),
    'limits.swift.closure_lines': settingNamespaceSchemas['limits'].shape['swift']
        .unwrap()
        .shape['closure_lines'].unwrap(),
    'limits.swift.type_lines': settingNamespaceSchemas['limits'].shape['swift'].unwrap().shape['type_lines'].unwrap(),
    'links.allowed_urls': settingNamespaceSchemas['links'].shape['allowed_urls'].unwrap(),
    'naming.allowed': settingNamespaceSchemas['naming'].shape['allowed'].unwrap(),
    'naming.banned': settingNamespaceSchemas['naming'].shape['banned'].unwrap(),
    'naming.case': settingNamespaceSchemas['naming'].shape['case'].unwrap(),
    'naming.max_chars': settingNamespaceSchemas['naming'].shape['max_chars'].unwrap(),
    'naming.max_words': settingNamespaceSchemas['naming'].shape['max_words'].unwrap(),
    'naming.reserved': settingNamespaceSchemas['naming'].shape['reserved'].unwrap(),
    'naming.sql.max_chars': settingNamespaceSchemas['naming'].shape['sql'].unwrap().shape['max_chars'].unwrap(),
    'naming.sql.max_words': settingNamespaceSchemas['naming'].shape['sql'].unwrap().shape['max_words'].unwrap(),
    'naming.swift.max_chars': settingNamespaceSchemas['naming'].shape['swift'].unwrap().shape['max_chars'].unwrap(),
    'naming.swift.max_words': settingNamespaceSchemas['naming'].shape['swift'].unwrap().shape['max_words'].unwrap(),
    'openapi.document': settingNamespaceSchemas['openapi'].shape['document'].unwrap(),
    'openapi.generate_command': settingNamespaceSchemas['openapi'].shape['generate_command'].unwrap(),
    'postgres.client_schemas': settingNamespaceSchemas['postgres'].shape['client_schemas'].unwrap(),
    'postgres.doc_sections': settingNamespaceSchemas['postgres'].shape['doc_sections'].unwrap(),
    'postgres.frozen_through': settingNamespaceSchemas['postgres'].shape['frozen_through'].unwrap(),
    'postgres.migrations_folder': settingNamespaceSchemas['postgres'].shape['migrations_folder'].unwrap(),
    'prose.locale': settingNamespaceSchemas['prose'].shape['locale'].unwrap(),
    'secrets.env_examples': settingNamespaceSchemas['secrets'].shape['env_examples'].unwrap(),
    'secrets.reader_functions': settingNamespaceSchemas['secrets'].shape['reader_functions'].unwrap(),
    'site.build_command': settingNamespaceSchemas['site'].shape['build_command'].unwrap(),
    'site.build_folder': settingNamespaceSchemas['site'].shape['build_folder'].unwrap(),
    'site.max_kilobytes': settingNamespaceSchemas['site'].shape['max_kilobytes'].unwrap(),
    'site.sitemap_exclude': settingNamespaceSchemas['site'].shape['sitemap_exclude'].unwrap(),
    'structure.reexports': settingNamespaceSchemas['structure'].shape['reexports'].unwrap(),
    'supabase.functions_folder': settingNamespaceSchemas['supabase'].shape['functions_folder'].unwrap(),
    'supabase.schemas': settingNamespaceSchemas['supabase'].shape['schemas'].unwrap(),
    'supabase.types_file': settingNamespaceSchemas['supabase'].shape['types_file'].unwrap(),
    'swift.xcode_destination': settingNamespaceSchemas['swift'].shape['xcode_destination'].unwrap(),
    'swift.xcode_project': settingNamespaceSchemas['swift'].shape['xcode_project'].unwrap(),
    'swift.xcode_scheme': settingNamespaceSchemas['swift'].shape['xcode_scheme'].unwrap(),
    'tools.codeql.languages': settingNamespaceSchemas['tools.codeql'].shape['languages'].unwrap(),
    'tools.codeql.suite': settingNamespaceSchemas['tools.codeql'].shape['suite'].unwrap(),
    'tools.commitlint.rules': settingNamespaceSchemas['tools.commitlint'].shape['rules'].unwrap(),
    'tools.commitlint.scopes': settingNamespaceSchemas['tools.commitlint'].shape['scopes'].unwrap(),
    'tools.commitlint.types': settingNamespaceSchemas['tools.commitlint'].shape['types'].unwrap(),
    'tools.eslint.import_extensions': settingNamespaceSchemas['tools.eslint'].shape['import_extensions'].unwrap(),
    'tools.eslint.node_version': settingNamespaceSchemas['tools.eslint'].shape['node_version'].unwrap(),
    'tools.eslint.overrides': settingNamespaceSchemas['tools.eslint'].shape['overrides'].unwrap(),
    'tools.eslint.restricted_imports': settingNamespaceSchemas['tools.eslint'].shape['restricted_imports'].unwrap(),
    'tools.eslint.rules': settingNamespaceSchemas['tools.eslint'].shape['rules'].unwrap(),
    'tools.eslint.runtimes': settingNamespaceSchemas['tools.eslint'].shape['runtimes'].unwrap(),
    'tools.hadolint.trusted_registries': settingNamespaceSchemas['tools.hadolint'].shape['trusted_registries'].unwrap(),
    'tools.knip.entry': settingNamespaceSchemas['tools.knip'].shape['entry'].unwrap(),
    'tools.knip.ignore_dependencies': settingNamespaceSchemas['tools.knip'].shape['ignore_dependencies'].unwrap(),
    'tools.markdownlint.rules': settingNamespaceSchemas['tools.markdownlint'].shape['rules'].unwrap(),
    'tools.nginx.image': settingNamespaceSchemas['tools.nginx'].shape['image'].unwrap(),
    'tools.purgecss.safelist': settingNamespaceSchemas['tools.purgecss'].shape['safelist'].unwrap(),
    'tools.ruff.docstring_convention': settingNamespaceSchemas['tools.ruff'].shape['docstring_convention'].unwrap(),
    'tools.semgrep.registry': settingNamespaceSchemas['tools.semgrep'].shape['registry'].unwrap(),
    'tools.semgrep.rule_files': settingNamespaceSchemas['tools.semgrep'].shape['rule_files'].unwrap(),
    'tools.sqlfluff.dialect': settingNamespaceSchemas['tools.sqlfluff'].shape['dialect'].unwrap(),
    'tools.squawk.assume_in_transaction':
        settingNamespaceSchemas['tools.squawk'].shape['assume_in_transaction'].unwrap(),
    'tools.stylelint.rules': settingNamespaceSchemas['tools.stylelint'].shape['rules'].unwrap(),
    'tools.svgo.min_saving_percent': settingNamespaceSchemas['tools.svgo'].shape['min_saving_percent'].unwrap(),
    'tools.swiftlint.keep_imports': settingNamespaceSchemas['tools.swiftlint'].shape['keep_imports'].unwrap(),
    'tools.trivy.severity': settingNamespaceSchemas['tools.trivy'].shape['severity'].unwrap(),
    'tools.v8r.schemas': settingNamespaceSchemas['tools.v8r'].shape['schemas'].unwrap(),
    'tools.yamllint.rules': settingNamespaceSchemas['tools.yamllint'].shape['rules'].unwrap(),
    'translations.base_locale': settingNamespaceSchemas['translations'].shape['base_locale'].unwrap(),
    'translations.messages_folder': settingNamespaceSchemas['translations'].shape['messages_folder'].unwrap(),
    'xcode.entitlements_allowed': settingNamespaceSchemas['xcode'].shape['entitlements_allowed'].unwrap(),
};
