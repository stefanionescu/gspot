/** Observe a child PID disappearing, with bounded cleanup if supervision fails. */
export async function waitForExit(pid: number): Promise<void> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid observed child PID: ${String(pid)}.`);
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
        try {
            process.kill(pid, 0);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
            throw error;
        }
        await Bun.sleep(10);
    }
    process.kill(pid, 'SIGKILL');
    throw new Error(`Owned child ${String(pid)} remained alive after supervision ended.`);
}
