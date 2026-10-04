import packageManifest from '#cli-package' with { type: 'json' };

/** Version of the CLI package used by commands and generated output. */
export const { version: RUNNING_VERSION } = packageManifest;

export const MAX_EXIT_CODE = 255;

/** Two items read together: a key and its value, an opening and closing quote, or two characters. */
export const PAIR = 2;

/** Milliseconds in a second, for durations shown in seconds. */
export const MS_PER_SECOND = 1000;

/** Bytes in a kilobyte, for sizes shown in kilobytes. */
export const BYTES_PER_KB = 1024;

/** The exit of a command that did not finish: an error, a refusal, an unreadable input, or a cancellation. */
export const EXIT_ERROR = 2;

export const MISSING_CODE = 127;

export const FAILED_CODE = 1;

// taskkill exits 128 when the process tree is already gone.
export const TASKKILL_GONE_CODE = 128;

// How long a terminated tool may keep its output pipes open.
export const DRAIN_MS = 5000;

// Bun emits exit before Darwin finishes reaping the group leader; descendants holding pipes are signaled after this.
export const REAP_MS = 10;

export const ROOT_SEARCH_DEPTH = 6;

export const DECLARATION_EXTENSIONS = ['.d.ts', '.d.mts', '.d.cts'];

/** The exit of a command that found something to fix: a finding, a broken tool for doctor. */
export const EXIT_FINDINGS = 1;

/** A whole share, for ratios shown as percentages. */
export const FULL_PERCENTAGE = 100;
