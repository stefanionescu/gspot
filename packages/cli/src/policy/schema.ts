// The zod schema of gspot.toml. Pure: no transforms, so the JSON schema is generated from it.
import { z } from 'zod';
import { outputSchema } from '#cli/presets/output-schema.ts';

const INDENT_MAX = 8;

const PRINT_WIDTH_MIN = 40;

const PRINT_WIDTH_MAX = 400;

const text = z.string();

const flag = z.boolean();

const textList = z.array(text);

const textListNonEmpty = textList.min(1);

const anyTable = z.record(text, z.unknown());

const reasoned = <T extends z.ZodType>(inner: T) => z.union([inner, z.strictObject({ value: inner, reason: text })]);

const reasonedNumber = reasoned(z.number());

const reasonedBoolean = reasoned(flag);

const reasonedTextList = reasoned(textList);

const limitTable = z.record(text, reasonedNumber);

const limitValue = z.union([reasonedNumber, limitTable]);
const limitsTable = z.record(text, limitValue);

const namingCategoryShape = {
    max_chars: reasonedNumber.optional(),
    max_words: reasonedNumber.optional(),
    case: reasonedTextList.optional(),
};

const namingCategory = z.strictObject(namingCategoryShape);

const namingLanguage = z.object(namingCategoryShape).catchall(namingCategory);

const namingRule = z.strictObject({
    paths: textListNonEmpty,
    languages: textList.optional(),
    categories: textList.optional(),
    names: textList.optional(),
    structural_prefix: text.optional(),
    allow_digits: flag.optional(),
    allow_duplicate_words: flag.optional(),
    exclude: flag.optional(),
    case: textList.optional(),
    reason: text.optional(),
});

const namedReason = z.strictObject({ name: text, reason: text });

const reservedTerm = z.strictObject({ term: text, allowed_for: textList });

const groupReason = z.strictObject({ group: text, reason: text });

const contractProperties = z.strictObject({ file: text, names: textList });

const namingLists = z.object({
    banned_terms: textList.optional(),
    allowed: z.array(namedReason).optional(),
    external: textList.optional(),
    reserved: z.array(reservedTerm).optional(),
    remove_groups: z.array(groupReason).optional(),
    contract_properties: z.array(contractProperties).optional(),
    rules: z.array(namingRule).optional(),
});

const element = z.strictObject({ name: text, paths: textList });

const allowedEdge = z.strictObject({ from: text, to: textList, reason: text.optional() });

const roleGlobs = z.union([text, textList]);

const architectureSchema = z.strictObject({
    types_directory: text.optional(),
    elements: z.array(element).optional(),
    edges_allowed: z.array(allowedEdge).optional(),
    roles: z.record(text, roleGlobs).optional(),
    contracts: z.array(anyTable).optional(),
});

const reasonedPaths = z.strictObject({ paths: textListNonEmpty, reason: text });

const callThrough = z.strictObject({ file: text, name: text, reason: text });

const trivialExemption = z.strictObject({ language: text.optional(), path: text, names: textList, reason: text });

const structureSchema = z.strictObject({
    reexports: z.enum(['none', 'index-only']).optional(),
    call_through_allowed: z.array(callThrough).optional(),
    trivial_allowed: z.array(trivialExemption).optional(),
    single_file_folder_allowed: z.array(reasonedPaths).optional(),
    prefix_collision_allowed: z.array(reasonedPaths).optional(),
    folder_name_allowed: z.array(reasonedPaths).optional(),
    python: anyTable.optional(),
});

const formatSchema = z.strictObject({
    indent_style: z.enum(['space', 'tab']).optional(),
    indent_width: z.number().int().min(1).max(INDENT_MAX).optional(),
    print_width: z.number().int().min(PRINT_WIDTH_MIN).max(PRINT_WIDTH_MAX).optional(),
    line_ending: z.enum(['lf', 'crlf']).optional(),
    newline_at_end: flag.optional(),
    quotes: z.enum(['single', 'double']).optional(),
    trailing_comma: z.enum(['all', 'es5', 'none']).optional(),
    semicolons: flag.optional(),
});

const disabledRule = z.strictObject({ rule: text, reason: text });

const proseSchema = z.strictObject({ vocabulary: textList.optional(), disabled: z.array(disabledRule).optional() });

const extraTable = z.object({ reason: text }).catchall(z.unknown());

const toolTable = z.object({ enabled: reasonedBoolean.optional(), extra: extraTable.optional() }).catchall(z.unknown());

const ignoreSchema = z.strictObject({
    check: text,
    rule: text.optional(),
    finding: text.optional(),
    paths: textList.optional(),
    reason: text,
});

const declareSchema = z.strictObject({
    paths: textListNonEmpty,
    produced_by: text.optional(),
    vendored: flag.optional(),
    reason: text.optional(),
});

const checkSchema = z
    .strictObject({
        name: text,
        command: textListNonEmpty,
        paths: textListNonEmpty,
        stage: z.enum(['commit', 'push', 'manual']),
        help: text.optional(),
        fix_command: textListNonEmpty.optional(),
        fix_order: z.enum(['codemod', 'imports', 'manifest', 'format']).optional(),
        count_regex: text.optional(),
        requires: z.enum(['build', 'docker', 'network']).optional(),
        platform: z.array(z.enum(['macos', 'linux', 'windows'])).optional(),
        summary: text.optional(),
        output: outputSchema.optional(),
    })
    .refine((check) => check.fix_command === undefined || check.fix_order !== undefined, {
        message: 'A fix_command requires fix_order.',
        path: ['fix_order'],
    })
    .meta({ dependentRequired: { fix_command: ['fix_order'] } });

const hooksSchema = z.strictObject({ tool: z.enum(['gspot', 'lefthook', 'husky', 'none']).optional() });

const ciPlatform = z.enum(['ubuntu', 'macos', 'windows']);

const ciSchema = z.strictObject({
    provider: z.enum(['github', 'none']).optional(),
    platforms: z.array(ciPlatform).optional(),
});

const rulesSchema = z.strictObject({
    install: flag.optional(),
    directory: text.optional(),
    project: text.optional(),
    exclude: textList.optional(),
});

const coverageSchema = z.strictObject({ strict: flag.optional() });

const runnerSchema = z.strictObject({ tool: z.enum(['mise', 'npm', 'bun', 'pnpm', 'uv', 'none']).optional() });

const namingTable = namingLists.catchall(namingLanguage);

const scopeBody = {
    limits: limitsTable.optional(),
    naming: namingTable.optional(),
    architecture: architectureSchema.optional(),
    structure: structureSchema.optional(),
    tools: z.record(text, toolTable).optional(),
    format: formatSchema.optional(),
};

/** One [[scope]] entry: its path, presets, and the per-scope tables. */
export const scopeSchema = z.strictObject({ path: text, presets: textList.optional(), ...scopeBody });

/** The whole of gspot.toml. */
export const policySchema = z.strictObject({
    version: z.number().int(),
    presets: textList.optional(),
    scope: z.array(scopeSchema).optional(),
    ...scopeBody,
    prose: proseSchema.optional(),
    ignore: z.array(ignoreSchema).optional(),
    declare: z.array(declareSchema).optional(),
    check: z.array(checkSchema).optional(),
    hooks: hooksSchema.optional(),
    ci: ciSchema.optional(),
    rules: rulesSchema.optional(),
    coverage: coverageSchema.optional(),
    runner: runnerSchema.optional(),
});
