/** @format */
export interface TailOptions {
    /**
     * Byte offset to start reading from. Defaults to 0 so an existing spool is
     * replayed from the beginning.
     */
    startOffset?: number;
}
export interface TailHandle {
    close(): void;
}
export declare function tail(file: string, onLine: (line: string) => void, options?: TailOptions): TailHandle;
