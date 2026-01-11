import { ContentProcessors } from './types';

function arrayEq(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; ++i){
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}

function startsWithArrayPrefix(arr: Uint8Array, prefixArr: Uint8Array) {
    return arrayEq(arr.subarray(0, prefixArr.length), prefixArr);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const contentDispositionPrefixUTF8 = encoder.encode('Content-Disposition: form-data;');
const contentTypePrefixUTF8 = encoder.encode('Content-Type:');

const finalByte = encoder.encode('-')[0];
const equalUTF8 = encoder.encode('=')[0];
const quoteUTF8 = encoder.encode('"')[0];

const nameUTF8 = encoder.encode('name');
const filenameUTF8 = encoder.encode('filename');


function processContent(contentProcessors: ContentProcessors, contentType: string, content: Uint8Array, filename?: string) {
    return {
        contentType,
        data: contentProcessors[contentType in contentProcessors ? contentType : 'default'](content),
        ...(filename !== undefined ? {filename} : {}),
    }
}


function addContentToResult<T>(result: T, name: string, content: any) {
    const value = result[name as keyof T];

    if (value === undefined) {
        result[name] = content;
        return;
    }

    if (Array.isArray(value)) {
        value.push(content);
        return;
    }

    result[name] = [value, content];
}


export function getLineEndIdx(array: Uint8Array, offset: number) {
    let prevByte;
    let currentByte = array[offset];

    for (let i = offset + 1; i < array.length; ++i) {
        prevByte = currentByte;
        currentByte = array[i];
        if (prevByte === 0x0d && currentByte === 0x0a) {
            return i - 1;
        }
    }

    return array.length;
}


function extractParam(params: Uint8Array, paramKey: Uint8Array){
    let endI = paramKey.length;

    if (params[endI] !== equalUTF8 || !arrayEq(params.subarray(0,  endI), paramKey)) {
        return undefined;
    }

    for (let i = endI + 2; i < params.length; ++i) {
        if (params[i] === quoteUTF8) {
            return {
                data: decoder.decode(params.subarray(endI + 2, i)),
                offset: i + 1
            };
        }
    }

    throw Error("Something went wrong during the params extraction");
}


function readContentDisposition(params: Uint8Array) {
    let name;
    let filename;

    for (let i = contentDispositionPrefixUTF8.length + 1; i < params.length; ++i) {
        const subArray = params.subarray(i);

        if (!name) {
            const extractedName = extractParam(subArray, nameUTF8);

            if (extractedName) {
                name = extractedName.data;
                i += extractedName.offset;
                continue
            }
        }

        if (!filename) {
            const extractedFilename = extractParam(subArray, filenameUTF8);

            if (extractedFilename) {
                filename = extractedFilename.data;
                i += extractedFilename.offset;
                continue;
            }
        }

        if (params[i - 1] === 0x0d && params[i] === 0x0a) {
            return { params: {name, filename}, offset: i + 1 };
        }
    }

    throw Error("Something went wrong during the content disposition params retrieval");
}

/**
 * Parses a multipart/form-data payload from an ArrayBuffer or Uint8Array.
 * @example
 * const testData = new TextEncoder().encode([
 *    'This is the preamble.  It is to be ignored',
 *    '',
 *    '------WebKitFormBoundary',
 *    'Content-Disposition: form-data; name="username"',
 *    '',
 *    'john_doe',
 *    '------WebKitFormBoundary',
 *    'Content-Disposition: form-data; name="binaryData"; filename="image.jpg"',
 *    'Content-Type: application/octet-stream',
 *    '',
 *    'some binary data',
 *    '------WebKitFormBoundary',
 *    'Content-Type: application/json',
 *    'Content-Disposition: form-data; name="metadata"',
 *    '',
 *    '{"age": 30, "location": "New York"}',
 *    '',
 *    '------WebKitFormBoundary',
 *    'Content-Disposition: form-data; name="username"',
 *    '',
 *    'hello world',
 *    '------WebKitFormBoundary--'
 *].join('\r\n'));
 *
 * let parsedData = parseMultipartFormData(testData, '----WebKitFormBoundary');
 * // the value of parsedData is:
 * // {
 * //   "username":[{"contentType":"text/plain","data":"john_doe"},{"contentType":"text/plain","data":"hello world"}],
 * //   "binaryData":{"contentType":"application/octet-stream","data":{"0":115,"1":111,"2":109,"3":101,"4":32,"5":98,"6":105,"7":110,"8":97,"9":114,"10":121,"11":32,"12":100,"13":97,"14":116,"15":97},"filename":"image.jpg"},
 * //   "metadata":{"contentType":"application/json","data":{"age":30,"location":"New York"}}
 * // }
 *
 *
 * // With content processors
 * parsedData = parseMultipartFormData(testData, '----WebKitFormBoundary', {
 *   'text/plain': content => new TextDecoder().decode(content).toUpperCase(),
 *   'application/octet-stream': content => new TextDecoder().decode(content),
 *   'default':  content => new TextDecoder().decode(content)
 *});
 * // the value of parsedData is:
 * // {
 * //   "username":[{"contentType":"text/plain","data":"JOHN_DOE"},{"contentType":"text/plain","data":"HELLO WORLD"}],
 * //   "binaryData":{"contentType":"application/octet-stream","data":"some binary data","filename":"image.jpg"},
 * //   "metadata":{"contentType":"application/json","data":{"age":30,"location":"New York"}}
 * // }
 *
 * @param inputArray - An ArrayBuffer or Uint8Array that contains the data (starting with offset 0).
 * @param boundary - The boundary string used by the multipart/form-data protocol.
 * @param contentProcessors - An object where each key is a MIME type (e.g. 'application/json')
 * and the value is a function that receives the body (of the multipart/form-data entry) as a Uint8Array and returns the processed result.
 * These are the default processors:
 * - 'text/plain': `content => new TextDecoder().decode(content)`
 * - 'application/json': `content => JSON.parse(new TextDecoder().decode(content))`
 * - 'default': content => content // matches any MIME type that does not have a defined processor
 *
 * These default behaviours can be overridden by providing a custom function for the specific MIME type.
 * @return An object having the multipart/form-data field names as keys and for their values:
 * - an object with the following fields: contentType, data and filename (if filename exists in the header)
 * - a list of the above-mentioned objects (for field names that are duplicate in the multipart/form-data payload)
 */
export function parseMultipartFormData<T>(inputArray: ArrayBuffer | Uint8Array, boundary: string, contentProcessors: ContentProcessors = {}) {
    const contentProcessorsWithDefaults = {
        'text/plain': (content: Uint8Array) => decoder.decode(content),
        'application/json': (content: Uint8Array) => JSON.parse(decoder.decode(content)),
        'default': (content: Uint8Array) => content,
        ...contentProcessors
    }

    const array = inputArray instanceof Uint8Array ? inputArray : new Uint8Array(inputArray);

    const separator = `--${boundary}`;
    const separatorUTF8 = encoder.encode(separator);

    const result = {} as T;

    let startIdx = 0;
    let lineEndIdx;
    let line;

    do {
        // skip preamble
        lineEndIdx = getLineEndIdx(array, startIdx);
        line = array.subarray(startIdx, lineEndIdx);
        startIdx = lineEndIdx + 2;
    } while (!startsWithArrayPrefix(line, separatorUTF8) && startIdx < array.length);

    lineEndIdx = startIdx;

    while (startIdx < array.length) {
        let name;
        let contentType;
        let filename;
        let content;

        startIdx = lineEndIdx;

        do {
            line = array.subarray(startIdx);

            if (!name && startsWithArrayPrefix(line, contentDispositionPrefixUTF8)) {
                const { params, offset } = readContentDisposition(line);
                name = params.name;
                filename = params.filename;

                startIdx += offset;
                continue;
            }

            if (!contentType && startsWithArrayPrefix(line, contentTypePrefixUTF8)) {
                lineEndIdx = getLineEndIdx(array, startIdx + contentTypePrefixUTF8.length);
                contentType = decoder.decode(array.subarray(startIdx + contentTypePrefixUTF8.length + 1, lineEndIdx));

                startIdx = lineEndIdx + 2;
                continue;
            }

            startIdx += 1;

            // exit when the next line is en empty one
        } while ((array[startIdx] !== 0x0d || array[startIdx + 1] !== 0x0a) && startIdx < array.length);

        if (!name) {
            throw Error("The entry name is missing");
        }

        contentType ??= 'text/plain';

        // skip the empty line
        startIdx += 1;

        lineEndIdx = startIdx;
        do {
            lineEndIdx = getLineEndIdx(array, lineEndIdx) + 2;
        } while (!startsWithArrayPrefix(array.subarray(lineEndIdx), separatorUTF8));

        line = array.subarray(startIdx + 1, lineEndIdx - 2);
        content = processContent(contentProcessorsWithDefaults, contentType, line, filename);
        addContentToResult(result, name, content);

        startIdx = lineEndIdx;
        lineEndIdx = getLineEndIdx(array, startIdx);
        line = array.subarray(startIdx + separatorUTF8.length, lineEndIdx); // -- portion of the separator

        if (line[0] === finalByte && line[1] === finalByte) {
            break;
        }

        lineEndIdx += 2;
    }

    return result;
}