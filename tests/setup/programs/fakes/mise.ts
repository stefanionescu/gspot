import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { dirname, delimiter } from 'node:path';
import { splitProgramArguments } from '#tests/setup/system/programs.ts';
import { buildSpawnEnvironment, readEnvironmentVariable } from '#cli/system/environment.ts';
import { INHERITED_STREAMS, CLI_PACKAGE_REQUEST, FAKE_CI_MISE_OPTIONS } from '#tests/config/setup/programs.ts';

const { own, call } = splitProgramArguments();

const { values } = parseArgs({ args: own, options: FAKE_CI_MISE_OPTIONS });

if (!call.some((argument) => argument.startsWith(CLI_PACKAGE_REQUEST))) {
    const nativeMise = values['native-mise'] ?? 'mise';
    const path = `${dirname(nativeMise)}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`;
    process.exitCode = Bun.spawnSync([nativeMise, ...call], {
        ...INHERITED_STREAMS,
        env: buildSpawnEnvironment({ PATH: path }),
    }).exitCode;
} else if (existsSync(values['failure-marker'] ?? '')) {
    process.stderr.write('npm error 404 Not Found - GET https://registry.npmjs.org/@gspothq/cli\n');
    process.exitCode = 1;
} else if (call.includes('bin-paths')) {
    process.stdout.write(`${dirname(values['failure-marker'] ?? '')}\n`);
} else if (call.includes('install')) {
    process.exitCode = 0;
} else {
    const cliArguments = call.slice(call.indexOf('--') + 2);
    process.exitCode = Bun.spawnSync(
        [process.execPath, values['cli-bin'] ?? '', ...cliArguments],
        INHERITED_STREAMS,
    ).exitCode;
}
