import { execaSync } from 'execa';
import { onExit } from 'signal-exit';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import type { ProcessTermination, ProcessTreeControl, CancelableSpawnOptions } from '#cli/types/system.ts';

import {
    FAILED_CODE,
    TASKKILL_FLAGS,
    TASKKILL_PROGRAM,
    TASKKILL_PID_FLAG,
    TASKKILL_GONE_CODE,
    STOP_POLL_MILLISECONDS,
    MILLISECONDS_PER_SECOND,
    PROCESS_CLEANUP_MESSAGE,
    STOP_GRACE_MILLISECONDS,
    EXIT_CLEANUP_MILLISECONDS,
    OUTPUT_CLOSE_MILLISECONDS,
} from '#cli/config/system.ts';

function isGroupGone(error: Error, child: ChildProcess): boolean {
    const hasExited = child.exitCode !== null || child.signalCode !== null;
    if (error instanceof GspotError) return process.platform === 'win32' && hasExited;
    if (hasErrorCode(error, 'ESRCH')) return true;
    return hasErrorCode(error, 'EPERM') && process.platform === 'darwin' && hasExited;
}

function killProcessTree(pid: number): void {
    if (process.platform !== 'win32') {
        process.kill(-pid, 'SIGKILL');
        return;
    }
    const result = execaSync(TASKKILL_PROGRAM, [TASKKILL_PID_FLAG, String(pid), ...TASKKILL_FLAGS], {
        reject: false,
        timeout: OUTPUT_CLOSE_MILLISECONDS,
    });
    const code = result.exitCode ?? FAILED_CODE;
    if (![0, TASKKILL_GONE_CODE].includes(code))
        throw new GspotError('tool', `Cannot stop the tool and its child processes: ${result.stderr}`);
}

/**
Send signal 0 to a process, or with a negative ID to its group, which tests that it exists without signaling it.

@returns the refusal of the system, or undefined when the process or group exists.
*/
function findSignalRefusal(pid: number): Error | undefined {
    try {
        process.kill(pid, 0);
        return undefined;
    } catch (error) {
        return error as Error;
    }
}

function isGroupRunning(child: ChildProcess, pid: number): boolean {
    const error = findSignalRefusal(-pid);
    return error === undefined || !isGroupGone(error, child);
}

async function askGroupToStop(child: ChildProcess, pid: number): Promise<void> {
    process.kill(-pid, 'SIGTERM');
    for (
        let waited = 0;
        waited < STOP_GRACE_MILLISECONDS && isGroupRunning(child, pid);
        waited += STOP_POLL_MILLISECONDS
    )
        await delay(STOP_POLL_MILLISECONDS);
}

function killTrackedTree(child: ChildProcess, termination: ProcessTermination): void {
    try {
        if (child.pid !== undefined) killProcessTree(child.pid);
    } catch (error) {
        if (!isGroupGone(error as Error, child)) termination.failure = error as Error;
    }
}

async function stopProcessTree(child: ChildProcess, pid: number, termination: ProcessTermination): Promise<void> {
    try {
        if (process.platform !== 'win32') await askGroupToStop(child, pid);
    } catch (error) {
        if (!isGroupGone(error as Error, child)) termination.failure = error as Error;
    }
    killTrackedTree(child, termination);
    child.kill('SIGKILL');
    termination.drainTimer = setTimeout(() => {
        const error = new Error(
            `Tool output did not close within ${String(OUTPUT_CLOSE_MILLISECONDS / MILLISECONDS_PER_SECOND)} seconds after gspot stopped the tool.`,
        );
        for (const stream of child.stdio) stream?.destroy(error);
    }, OUTPUT_CLOSE_MILLISECONDS);
}

/**
Check a process without signaling it. A permission refusal still means that the process exists.
*/
export function isProcessRunning(pid: number): boolean {
    const error = findSignalRefusal(pid);
    if (error === undefined || hasErrorCode(error, 'EPERM')) return true;
    if (hasErrorCode(error, 'ESRCH')) return false;
    throw error;
}

export function trackProcessTree(child: ChildProcess, options: CancelableSpawnOptions): ProcessTreeControl {
    const state = { timedOut: false, canceled: false };
    const termination: ProcessTermination = { stopped: false, failure: undefined, drainTimer: undefined };
    const stopTree = () => {
        if (termination.stopped || child.pid === undefined) return;
        termination.stopped = true;
        termination.stopping = stopProcessTree(child, child.pid, termination);
    };
    const stopOnAbort = () => {
        if (termination.stopped) return;
        state.canceled = true;
        stopTree();
    };
    const removeExitListener = onExit(() => {
        killTrackedTree(child, termination);
    });
    const timer =
        options.timeoutSeconds === undefined
            ? undefined
            : setTimeout(() => {
                  if (termination.stopped) return;
                  state.timedOut = true;
                  stopTree();
              }, options.timeoutSeconds * MILLISECONDS_PER_SECOND);
    let exitCleanup: Promise<void> | undefined;
    const startExitCleanup = () => {
        clearTimeout(timer);
        exitCleanup = (async () => {
            if (process.platform !== 'win32' && child.pid !== undefined && isGroupRunning(child, child.pid)) {
                await delay(EXIT_CLEANUP_MILLISECONDS);
                stopTree();
            }
            termination.stopped = true;
        })();
    };
    const streams = child.stdio.filter((stream) => stream !== null && stream !== undefined);
    child.once('exit', startExitCleanup);
    for (const stream of streams) stream.once('error', stopTree);
    options.cancelSignal?.addEventListener('abort', stopOnAbort, { once: true });
    if (options.cancelSignal?.aborted === true) stopOnAbort();
    return {
        state,
        stop: stopTree,
        async release(processFailure: unknown) {
            await exitCleanup;
            await termination.stopping;
            clearTimeout(timer);
            clearTimeout(termination.drainTimer);
            removeExitListener();
            options.cancelSignal?.removeEventListener('abort', stopOnAbort);
            child.removeListener('exit', startExitCleanup);
            for (const stream of streams) stream.removeListener('error', stopTree);
            if (termination.failure === undefined || isGroupGone(termination.failure, child)) return;
            throw processFailure === undefined
                ? termination.failure
                : new AggregateError([processFailure, termination.failure], PROCESS_CLEANUP_MESSAGE);
        },
    };
}
