/**
Compare text by code units so paths and generated names keep the same order in every locale.
*/
export function compareText(left: string, right: string): number {
    if (left < right) return -1;
    return left > right ? 1 : 0;
}
