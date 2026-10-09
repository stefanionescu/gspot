import { FORMAT_RESULT } from '#cli/config/parsers/tool/format.ts';
import { PROGRAM_ARGUMENT_OFFSET } from '#cli/config/platform/runtime.ts';
import { formatConfigurationSchema } from '#cli/parsers/schema/format.ts';
import { check, resolveConfig, getSupportInfo, resolveConfigFile } from 'prettier';

// Frame the native options so authored console output cannot enter the caller's JSON.
const file = process.argv[PROGRAM_ARGUMENT_OFFSET];
if (file === undefined) throw new Error('The formatter project path is missing.');
const configuration = await resolveConfigFile(file);
const usesPrettier = configuration !== null || process.argv[PROGRAM_ARGUMENT_OFFSET + 1] === 'true';
const options = await resolveConfig(file, { editorconfig: !usesPrettier, useCache: false });
await check('', { ...options, parser: 'json' });
let defaults = {};
if (usesPrettier) {
    const declarations = await getSupportInfo();
    defaults = Object.fromEntries(
        declarations.options.flatMap((option) =>
            option.name !== undefined && ['tabWidth', 'printWidth', 'singleQuote'].includes(option.name)
                ? [[option.name, option.default] as const]
                : [],
        ),
    );
}
process.stdout.write(
    `${FORMAT_RESULT}${JSON.stringify(formatConfigurationSchema.parse(usesPrettier ? { ...defaults, ...options } : options))}\n`,
);
