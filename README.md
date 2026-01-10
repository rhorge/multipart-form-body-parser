# A multipart/form-data parser for JavaScript / TypeScript
A lightweight, zero-dependency multipart/form-data (MIME type) parser that works in both client and server-side environments (Browser and Node.js).

## Highlights
- Universal: Compatible with Browser and Node.js.
- Optimized: Works at the byte level (Uint8Array) for high performance.
- Type-safe: Written in TypeScript with generics support.
- Zero Dependencies: No external bloat.

## Install

```sh
    yarn add multipart-form-body-parser
```
or
```sh
    npm install multipart-form-body-parser
```

## Usage

### Basic Example

The following example works both in Node and browser.

```typescript
import { readBoundary, parseMultipartFormData } from 'multipart-form-body-parser';

const testData = new TextEncoder().encode([
    'This is the preamble.  It is to be ignored',
    '',
    '------WebKitFormBoundary',
    'Content-Disposition: form-data; name="username"',
    '',
    'john_doe',
    '------WebKitFormBoundary',
    'Content-Disposition: form-data; name="binaryData"; filename="image.jpg"',
    'Content-Type: application/octet-stream',
    '',
    'some binary data',
    '------WebKitFormBoundary',
    'Content-Type: application/json',
    'Content-Disposition: form-data; name="metadata"',
    '',
    '{"age": 30, "location": "New York"}',
    '',
    '------WebKitFormBoundary',
    'Content-Disposition: form-data; name="username"',
    '',
    'hello world',
    '------WebKitFormBoundary--'
].join('\r\n'));

// Basic parsing
let parsedData = parseMultipartFormData<ParseResult>(testData, '----WebKitFormBoundary');
// the value of parsedData is:
// {
//   "username":[{"contentType":"text/plain","data":"john_doe"},{"contentType":"text/plain","data":"hello world"}],
//   "binaryData":{"contentType":"application/octet-stream","data":Uint8Array(16) [ ... ],"filename":"image.jpg"},
//   "metadata":{"contentType":"application/json","data":{"age":30,"location":"New York"}}
// }


// Parsing with custom content processors
parsedData = parseMultipartFormData<ParseResult>(testData, '----WebKitFormBoundary', {
    'text/plain': content => new TextDecoder().decode(content).toUpperCase(),
    'application/octet-stream': content => new TextDecoder().decode(content),
    'default':  content => new TextDecoder().decode(content)
});
// the value of parsedData is:
// {
//   "username":[{"contentType":"text/plain","data":"JOHN_DOE"},{"contentType":"text/plain","data":"HELLO WORLD"}],
//   "binaryData":{"contentType":"application/octet-stream","data":"some binary data","filename":"image.jpg"},
//   "metadata":{"contentType":"application/json","data":{"age":30,"location":"New York"}}
// }
```

### Browser

Example of parsing a standard fetch response:

```typescript
import { readBoundary, parseMultipartFormData } from 'multipart-form-body-parser';

const response = await fetch('/api');

const contentType = response.headers.get('content-type');

if (!contentType) {
    throw Error('The content-type header is missing');
}

// extracts the boundary from the content-type header 
const boundary = readBoundary(contentType);

// reads the response as an ArrayBuffer
const buffer = await response.arrayBuffer();

// parses the result
const result = parseMultipartFormData<T>(buffer, boundary);
```

## Description
This package offers you all the tools needed to parse a multipart/form-data response in JavaScript (TypeScript)
without relying on any external dependency. It is highly optimized, because it works at a very low level (bytes) 
to give the best performance possible.

## API Reference

### readBoundary(content) 
Extracts the boundary key from a Content-Type header or a raw string.

```typescript
readBoundary('multipart/form-data; boundary=----boundary');
// the result is: "----boundary"
```

### parseMultipartFormData(inputArray, boundary, contentProcessors?)
Parses a multipart/form-data payload into a structured JavaScript object.

Parameters:
- inputArray - ArrayBuffer or Uint8Array that contains the raw payload
- boundary - The boundary string used by the multipart/form-data payload to delimit its sections
- contentProcessors (Optional) - An object that enables you to define a processor callback for specific MIME types.
Each callback receives the multipart/form-data entity's body (an Uint8Array) as argument and returns the processed response. 
By default, it has the following configuration (that can be overridden):
```typescript
{
    'text/plain': (content: Uint8Array) => decoder.decode(content), 
    'application/json': (content: Uint8Array) => JSON.parse(decoder.decode(content)), 
    'default': (content: Uint8Array) => content
}
```

Return Value: An object where:
- Each key corresponds to the name parameter in the Content-Disposition header.
- Each value is an object (or an array of objects for duplicate keys) containing:
  - contentType: The MIME type of the part.
  - data: The processed content. 
  - filename: The filename (if present in the payload). 

Let's see a concrete usage:

```typescript
const testData = new TextEncoder().encode([
    'This is the preamble.  It is to be ignored',
    '',
    '------WebKitFormBoundary',
    'Content-Disposition: form-data; name="username"',
    '',
    'john_doe',
    '------WebKitFormBoundary',
    'Content-Disposition: form-data; name="binaryData"; filename="image.jpg"',
    'Content-Type: application/octet-stream',
    '',
    'some binary data',
    '------WebKitFormBoundary',
    'Content-Type: application/json',
    'Content-Disposition: form-data; name="metadata"',
    '',
    '{"age": 30, "location": "New York"}',
    '',
    '------WebKitFormBoundary',
    'Content-Disposition: form-data; name="username"',
    '',
    'hello world',
    '------WebKitFormBoundary--'
].join('\r\n'));

parseMultipartFormData<ParseResult>(testData, '----WebKitFormBoundary');
// the returned value is:
// {
//   "username":[{"contentType":"text/plain","data":"JOHN_DOE"},{"contentType":"text/plain","data":"HELLO WORLD"}],
//   "binaryData":{"contentType":"application/octet-stream","data":"some binary data","filename":"image.jpg"},
//   "metadata":{"contentType":"application/json","data":{"age":30,"location":"New York"}}
// }
```

In this case, the returned value has the following keys: "username", "binaryData" and "metadata". These keys
are the ones present in the Content-Disposition's name parameter. For each entry in the multipart/form-data payload
an object with contentType, data and filename (if exists) fields is created.

```typescript
{
    contentType: "application/octet-stream", 
    data: "some binary data", 
    filename: "image.jpg" // only if exists in the payload
}
```

The contentType and the filename are copied from the multipart/form-data header. The data field is
computed using the following function: 

``` typescript
// The content parameter represents that portion of the inputArray (computed using subArray method)
// that contains the body of the multipart/form-data entity.
// If the contentType is not defined in contentProcessors the 'default' processor is used
const data = contentProcessors[contentType in contentProcessors ? contentType : 'default'](content)
```

If the same name field (duplicate) appears multiple times in multipart/form-data headers, the resulting object will
be aggregated in a list:


```typescript
[
    {contentType: "text/plain", data: "JOHN_DOE"},
    {contentType: "text/plain", data: "HELLO WORLD"}
]
```

### Considerations

- Encoding: The parser currently supports UTF-8 for both headers and body.
- RFC Compliance: While RFC 7578 suggests boundaries are often enclosed in quotes, readBoundary is designed to extract the key regardless of quoting.
- Performance: By working directly with bytes (subarrays) rather than large string conversions, the parser maintains a low memory footprint.

## License
MIT