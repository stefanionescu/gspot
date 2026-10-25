import { buildProgramCommand } from '#tests/setup/system/programs.ts';

export const QUALITY_COMMAND = buildProgramCommand(
    'checks/search',
    '--text',
    'corrected\n',
    '--match',
    'differs',
    '--log',
    'checked.txt',
    '--',
    '{files}',
);

export const QUALITY_FIX = buildProgramCommand(
    'fakes/tool',
    '--log-arguments',
    'fixed.txt',
    '--text',
    'corrected\n',
    '--',
    '{files}',
);
