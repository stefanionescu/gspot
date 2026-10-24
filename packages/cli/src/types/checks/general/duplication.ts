export type CloneLocation = { name: string; start: number };

export type CloneReport = {
    duplicates: {
        lines: number;
        firstFile: CloneLocation;
        secondFile: CloneLocation;
    }[];
};
