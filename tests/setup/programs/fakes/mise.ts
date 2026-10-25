import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { dirname, delimiter } from 'node:path';
import { splitProgramArguments } from '#tests/setup/system/programs.ts';
import { buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';
import { CLI_PACKAGE_REQUEST, FAKE_CI_MISE_OPTIONS } from '#tests/config/setup/programs.ts';

const { own, call } = splitProgramArguments();
const { values } = parseArgs({ args: own, options: FAKE_CI_MISE_OPTIONS });
const streams = { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' } as const;
if (!call.includes('exec') || !call.some((argument) => argument.startsWith(CLI_PACKAGE_REQUEST))) {
    const nativeMise = values['native-mise'] ?? 'mise';
    const path = `${dirname(nativeMise)}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`;
    process.exitCode = Bun.spawnSync([nativeMise, ...call], {
        ...streams,
        env: buildSpawnEnvironment({ PATH: path }),
    }).exitCode;
} else if (existsSync(values['failure-marker'] ?? '')) {
    process.stderr.write('npm error 404 Not Found - GET https://registry.npmjs.org/@gspothq/cli\n');
    process.exitCode = 1;
} else {
    const cliArguments = call.slice(call.indexOf('--') + 2);
    process.exitCode = Bun.spawnSync([process.execPath, values['cli-bin'] ?? '', ...cliArguments], streams).exitCode;
}
