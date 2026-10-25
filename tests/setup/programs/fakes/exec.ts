import { splitProgramArguments } from '#tests/setup/system/programs.ts';

const { own, call } = splitProgramArguments();
process.exitCode =
    own[0] === 'exec' && call.length > 0
        ? Bun.spawnSync(call, { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }).exitCode
        : 2;
