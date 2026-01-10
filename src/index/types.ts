export type ContentProcessors = {
    [key: string]: (content: Uint8Array) => any
}