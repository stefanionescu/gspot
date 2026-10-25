import { parseArgs } from 'node:util';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { DESCRIBE_CALL_OPTIONS } from '#tests/config/setup/programs.ts';
import { splitProgramArguments } from '#tests/setup/system/programs.ts';

const { own, call } = splitProgramArguments();
const { values } = parseArgs({ args: own, options: DESCRIBE_CALL_OPTIONS });
const environment = (values.environment ?? []).map((name): [string, string | null] => [
    name,
    readEnvironmentVariable(name) ?? null,
]);
const description = {
    arguments: call,
    environment: Object.fromEntries(environment),
    cwd: process.cwd(),
    ...(values.stdin === true && { stdin: await Bun.stdin.text() }),
};
process.stdout.write(`${JSON.stringify(description)}\n`);
