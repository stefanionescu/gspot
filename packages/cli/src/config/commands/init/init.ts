import { HOOKS_CHANGED_NOTE, TOOLS_CHANGED_NOTE } from '#cli/config/generation/write.ts';

export const INIT_INSTALL_NOTES: ReadonlySet<string> = new Set([HOOKS_CHANGED_NOTE, TOOLS_CHANGED_NOTE]);

export const NO_TERMINAL_MESSAGE = 'There is no terminal to ask in. Pass --yes to accept the plan.';

export const CANCELED_MESSAGE = 'Canceled. Nothing was written.';

export const CONFIRM_PROMPT = 'Continue? [Y/n] ';

export const ACCEPT_ANSWER = /^(?:y|yes)?$/iu;

export const WROTE_PLAN_MESSAGE = 'Wrote the plan above.';

export const SETTINGS_EXIST_MESSAGE =
    'This repository already has a gspot.toml. Run gspot doctor to inspect its setup; it prints the gspot add line for newly detected configurations.';

export const NOTHING_WRITTEN_MESSAGE = 'Nothing written.\n';

export const NEXT_INSTALL_MESSAGE = 'Next: run gspot install to install the tools and turn on the Git hooks.';

export const CONFIGURATIONS_OPTION = '--configurations <names...>';

export const NO_CONFIGURATIONS_FLAG = '--no-configurations';

export const LEVEL_OPTION = '--level <level>';

export const YES_FLAG = '--yes';

export const JSON_NEEDS_YES_MESSAGE = '--json needs --yes, because gspot cannot ask while it prints JSON.';
