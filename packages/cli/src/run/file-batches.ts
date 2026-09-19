// Batches of file arguments, so no command line passes what the platform accepts.

/**
 * Splits a file list so that no command line passes the byte budget; one batch when the list fits.
 * @param files the file paths
 * @param budget the bytes the file arguments may take
 * @returns the batches, in order
 */
export function fileBatches(files: string[], budget: number): string[][] {
    const batches: string[][] = [[]];
    let used = 0;
    for (const file of files) {
        const size = file.length + 1;
        const current = batches.at(-1) ?? [];
        if (used + size > budget && current.length > 0) {
            batches.push([file]);
            used = size;
        } else {
            current.push(file);
            used += size;
        }
    }
    return batches;
}
