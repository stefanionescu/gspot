import type { CommandResult } from '#cli/types/terminal.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';

/** The validated authored policy a command previews without publishing. */
export type PolicyPlanJson = { changed: boolean; policy: string; diff: string; dryRun: true };

/** An authored mutation and its command result choices. */
export type SavePolicyOptions = { change: Mutation; summary: string; isDryRun: boolean };

/** A saved policy edit together with the managed apply result when apply completed. */
export type PolicySaveResult =
    | CommandResult<PolicyPlanJson>
    | (CommandResult & {
          json: {
              changed: boolean;
              applied?: false;
              notes?: string[];
              error?: 'preparation' | 'apply';
              message?: string;
          };
      });
