import { isDeepStrictEqual, parseArgs } from 'node:util';

const EXPECT_ARGUMENTS_OPTIONS = { includes: { type: 'string' }, equals: { type: 'string' } } as const;

const { values, positionals } = parseArgs({ options: EXPECT_ARGUMENTS_OPTIONS, allowPositionals: true });
const isIncluded = values.includes === undefined || positionals.includes(values.includes);
const isEqual = values.equals === undefined || isDeepStrictEqual(positionals, JSON.parse(values.equals));
process.exitCode = isIncluded && isEqual ? 0 : 1;
