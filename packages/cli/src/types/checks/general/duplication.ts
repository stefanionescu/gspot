export type CloneLocation = { name: string; start: number };

export type JscpdOutput = {
    duplicates: {
        lines: number;
        firstFile: CloneLocation;
        secondFile: CloneLocation;
    }[];
};
