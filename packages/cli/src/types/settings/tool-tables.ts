import type { Optional } from '#cli/types/shapes.ts';
import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { SettingValue } from '#cli/types/settings/file.ts';
import type { RULE_CONDITIONS, DOCSTRING_CONVENTIONS, IMPORT_EXTENSION_STYLES } from '#cli/config/settings/schema.ts';

type ParsedExtraOptions = { extra?: Record<string, unknown> | undefined };

type WrittenTools = {
    hadolint?: { trusted_registries?: string[] | undefined } | undefined;
    nginx?: { image?: string | undefined } | undefined;
    ruff?: { docstring_convention?: (typeof DOCSTRING_CONVENTIONS)[number] | undefined } | undefined;
    semgrep?: { registry_packs?: string[] | undefined; rule_files?: string[] | undefined } | undefined;
    sqlfluff?: { dialect?: string | undefined } | undefined;
    swiftlint?: { always_keep_imports?: string[] | undefined } | undefined;
    trivy?: { severity?: string[] | undefined } | undefined;
    eslint?:
        | (Optional<Omit<ParsedEslint, 'extra'>> & {
              extra?: { value: Record<string, unknown>; reason: string } | undefined;
          })
        | undefined;
    commitlint?:
        | {
              types?: string[] | undefined;
              scopes?: string[] | undefined;
              rules?: Record<string, [(typeof RULE_CONDITIONS)[number], (JsonValue | undefined)?]> | undefined;
          }
        | undefined;
    yamllint?: Optional<ParsedYamllint> | undefined;
    markdownlint?: { rules?: Record<string, Record<string, JsonValue>> | undefined } | undefined;
    stylelint?: Optional<ParsedStylelint> | undefined;
    squawk?: { assume_in_transaction?: boolean | undefined } | undefined;
    prettier?: { extra?: { value: Record<string, unknown>; reason: string } | undefined } | undefined;
    'editorconfig-checker'?: { extra?: { value: Record<string, unknown>; reason: string } | undefined } | undefined;
    typos?: { extra?: { value: Record<string, unknown>; reason: string } | undefined } | undefined;
    shellcheck?: { extra?: { value: Record<string, unknown>; reason: string } | undefined } | undefined;
    knip?:
        | {
              extra?: { value: Record<string, unknown>; reason: string } | undefined;
              entry?: string[] | undefined;
              ignore_dependencies?: SettingValue<string[]> | undefined;
          }
        | undefined;
    purgecss?: { safelist?: SettingValue<string[]> | undefined } | undefined;
    v8r?: { schema?: { paths: string[]; url: string }[] | undefined } | undefined;
    taplo?: { extra?: { value: Record<string, unknown>; reason: string } | undefined } | undefined;
};

type ParsedHadolint = { trusted_registries: string[] };

type ParsedNginx = { image: string };

type ParsedRuff = { docstring_convention?: (typeof DOCSTRING_CONVENTIONS)[number] | undefined };

type ParsedSemgrep = { registry_packs: string[]; rule_files: string[] };

type ParsedSqlfluff = { dialect: string };

type ParsedSwiftlint = { always_keep_imports: string[] };

type ParsedTrivy = { severity: string[] };

type ParsedEslint = {
    extra?: Record<string, unknown> | undefined;
    import_extension: (typeof IMPORT_EXTENSION_STYLES)[number];
    restricted_imports: { name: string; message: string }[];
    rules: Record<
        string,
        unknown[] | [string | number | boolean | null | JsonValue[] | Record<string, JsonValue>, ...JsonValue[]]
    >;
    override: {
        paths: string[];
        rules?: ParsedEslint['rules'] | undefined;
        runtime?: string | undefined;
    }[];
    plugins: { name: string; path: string; rules: ParsedEslint['rules'] }[];
};

type ParsedCommitlint = {
    types: string[];
    scopes: string[];
    rules: Record<string, [(typeof RULE_CONDITIONS)[number], (JsonValue | undefined)?]>;
};

type ParsedYamllint = {
    rules: {
        indentation?:
            | {
                  level?: 'error' | undefined;
                  ignore?: unknown;
                  'ignore-from-file'?: unknown;
                  spaces?: 'consistent' | undefined;
              }
            | undefined;
    };
};

type ParsedMarkdownlint = { rules: Record<string, Record<string, JsonValue>> };

type ParsedStylelint = {
    rules: Record<
        string,
        | true
        | string
        | number
        | { severity?: 'error' | undefined }
        | [
              true | string | number | { severity?: 'error' | undefined } | JsonValue[],
              ({ severity?: 'error' | undefined } | undefined)?,
          ]
    >;
};

type ParsedSquawk = { assume_in_transaction: boolean };

type ParsedKnip = { extra?: Record<string, unknown> | undefined; entry: string[]; ignore_dependencies: string[] };

type ParsedPurgecss = { safelist: string[] };

type ParsedV8r = { schema: { paths: string[]; url: string }[] };

type ParsedTools = {
    hadolint?: ParsedHadolint | undefined;
    nginx?: ParsedNginx | undefined;
    ruff?: ParsedRuff | undefined;
    semgrep?: ParsedSemgrep | undefined;
    sqlfluff?: ParsedSqlfluff | undefined;
    swiftlint?: ParsedSwiftlint | undefined;
    trivy?: ParsedTrivy | undefined;
    eslint?: ParsedEslint | undefined;
    commitlint?: ParsedCommitlint | undefined;
    yamllint?: ParsedYamllint | undefined;
    markdownlint?: ParsedMarkdownlint | undefined;
    stylelint?: ParsedStylelint | undefined;
    squawk?: ParsedSquawk | undefined;
    prettier?: ParsedExtraOptions | undefined;
    'editorconfig-checker'?: ParsedExtraOptions | undefined;
    typos?: ParsedExtraOptions | undefined;
    shellcheck?: ParsedExtraOptions | undefined;
    knip?: ParsedKnip | undefined;
    purgecss?: ParsedPurgecss | undefined;
    v8r?: ParsedV8r | undefined;
    taplo?: ParsedExtraOptions | undefined;
};

export type { ParsedTools, WrittenTools };
