import cliPackage from '#cli-package' with { type: 'json' };

export const PIN_MESSAGE = [
    `This repository pins gspot 9.9.9, and you are running gspot ${cliPackage.version}.`,
    'Install the pinned version: mise use --pin --tool-option allow_low_downloads=true npm:@gspothq/cli@9.9.9',
    'To upgrade the repository pin to this version: gspot apply',
].join('\n');
