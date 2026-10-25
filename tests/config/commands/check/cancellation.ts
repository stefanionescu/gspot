import { buildProgramCommand } from '#tests/setup/system/programs.ts';

export const SLOW_COMMAND_CHECK = {
    id: 'project/slow',
    stage: 'commit',
    paths: ['source.txt'],
    command: buildProgramCommand('fakes/tool', '--mark', 'started.pid', '--wait'),
};
