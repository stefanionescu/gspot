declare global {
    /** Replaced by the standalone bundler; source and npm builds leave it undefined. */
    const GSPOT_STANDALONE: boolean;
}

/** Checksummed upstream build input, including grammar licenses. */
export type PinnedDownload = { url: string; checksum: string };
