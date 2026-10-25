import { parseArgs, isDeepStrictEqual } from 'node:util';
import { EXPECT_ARGUMENTS_OPTIONS } from '#tests/config/setup/programs.ts';

const { values, positionals } = parseArgs({ options: EXPECT_ARGUMENTS_OPTIONS, allowPositionals: true });
const isIncluded = values.includes === undefined || positionals.includes(values.includes);
const isEqual = values.equals === undefined || isDeepStrictEqual(positionals, JSON.parse(values.equals));
process.exitCode = isIncluded && isEqual ? 0 : 1;
