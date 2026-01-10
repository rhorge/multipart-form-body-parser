/**
 * Returns the boundary string from the provided string parameter using a regex
 * @param content the string from which the boundary will be extracted
 * @example
 * const boundary = readBoundary("multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW");
 * // the value of boundary is: "----WebKitFormBoundary7MA4YWxkTrZu0gW"
 */
export function readBoundary(content: string) {
    const boundary = /boundary\s*=\s*("?([^";]+)"?)/.exec(content);

    if (!boundary) {
        throw Error('The boundary param is missing');
    }

    const value = boundary[1];

    return value[0] === '"' && value[value.length - 1] === '"' ? value.slice(1, -1) : value;
}