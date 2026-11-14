import { SIGNAL_EXIT_CODES } from '#cli/config/system.ts';
import type { CommandResult, CanceledCommandJson } from '#cli/types/system.ts';

export async function runCancelableCommand<Json extends object>(
    runCommand: (cancelSignal: AbortSignal) => Promise<CommandResult<Json>>,
    canceledMessage: string,
): Promise<CommandResult<Json | CanceledCommandJson>> {
    const controller = new AbortController();
    const cancellations = Object.entries(SIGNAL_EXIT_CODES).map(([signal, code]) => ({
        signal,
        onSignal: (): void => {
            controller.abort(code);
        },
    }));
    for (const { signal, onSignal } of cancellations) process.on(signal, onSignal);
    try {
        const result = await runCommand(controller.signal);
        if (!controller.signal.aborted) return result;
        const exitCode = Number(controller.signal.reason);
        return { ...result, exitCode, json: { ...result.json, exitCode } };
    } catch (error) {
        if (!controller.signal.aborted) throw error;
        return {
            text: `${canceledMessage}\n`,
            json: { error: 'canceled', message: canceledMessage },
            exitCode: Number(controller.signal.reason),
        };
    } finally {
        for (const { signal, onSignal } of cancellations) process.removeListener(signal, onSignal);
    }
}
