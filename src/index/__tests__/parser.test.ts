import { parseMultipartFormData } from '../parser';

export type ParseResult = {
    username: {
        data: string;
        contentType: string;
    },
    profile_picture: {
        data: ArrayBuffer;
        contentType: string;
        filename: string;
    }[],
    metadata: {
        data: {
            age: number;
            location: string;
        }
    }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

test('parse array buffer', () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

    const testData = encoder.encode([
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="username"',
        '',
        'john_doe',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="profile_picture"; filename="profile.jpg"',
        'Content-Type: image/jpeg',
        '',
        '  [Binary data of the JPEG file]',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Type: application/octet-stream',
        'Content-Disposition: form-data; name="profile_picture"; filename="profile2.jpg"',
        '',
        '  [Some other binary data]',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Type: application/json',
        'Content-Disposition: form-data; name="metadata"',
        '',
        '{"age": 30, "location": "New York"}',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--'
    ].join('\r\n'));

    const parsedData = parseMultipartFormData<ParseResult>(testData, boundary)

    expect(parsedData.username.data).toBe('john_doe');
    expect(parsedData.username.contentType).toBe('text/plain');

    expect([...new Uint8Array(parsedData.profile_picture[0].data)]).toEqual([...encoder.encode('  [Binary data of the JPEG file]')]);
    expect(parsedData.profile_picture[0].contentType).toBe('image/jpeg');
    expect(parsedData.profile_picture[0].filename).toBe('profile.jpg');

    expect([...new Uint8Array(parsedData.profile_picture[1].data)]).toEqual([...encoder.encode('  [Some other binary data]')]);
    expect(parsedData.profile_picture[1].contentType).toBe('application/octet-stream');
    expect(parsedData.profile_picture[1].filename).toBe('profile2.jpg');

    expect(parsedData.metadata.data.age).toBe(30);
    expect(parsedData.metadata.data.location).toBe("New York");
});


test('parse array buffer with preamble', () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

    const testData = encoder.encode([
        'This is the preamble.  It is to be ignored, though it',
        'is a handy place for composition agents to include an',
        'explanatory note to non-MIME conformant readers.',
        '',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="username"',
        '',
        'john_doe',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="profile_picture"; filename="profile.jpg"',
        'Content-Type: image/jpeg',
        '',
        '  [Binary data of the JPEG file]',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Type: application/octet-stream',
        'Content-Disposition: form-data; name="profile_picture"; filename="profile2.jpg"',
        '',
        '  [Some other binary data]',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Type: application/json',
        'Content-Disposition: form-data; name="metadata"',
        '',
        '{"age": 30, "location": "New York"}',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--'
    ].join('\r\n'));

    const parsedData = parseMultipartFormData<ParseResult>(testData, boundary)

    expect(parsedData.username.data).toBe('john_doe');
    expect(parsedData.username.contentType).toBe('text/plain');

    expect([...new Uint8Array(parsedData.profile_picture[0].data)]).toEqual([...encoder.encode('  [Binary data of the JPEG file]')]);
    expect(parsedData.profile_picture[0].contentType).toBe('image/jpeg');
    expect(parsedData.profile_picture[0].filename).toBe('profile.jpg');

    expect([...new Uint8Array(parsedData.profile_picture[1].data)]).toEqual([...encoder.encode('  [Some other binary data]')]);
    expect(parsedData.profile_picture[1].contentType).toBe('application/octet-stream');
    expect(parsedData.profile_picture[1].filename).toBe('profile2.jpg');

    expect(parsedData.metadata.data.age).toBe(30);
    expect(parsedData.metadata.data.location).toBe("New York");
});

test('parse with content processors', () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

    const testData = encoder.encode([
        'This is the preamble.  It is to be ignored, though it',
        'is a handy place for composition agents to include an',
        'explanatory note to non-MIME conformant readers.',
        '',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="username"',
        '',
        'john_doe',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="profile_picture"; filename="profile.jpg"',
        'Content-Type: image/jpeg',
        '',
        '  [Binary data of the JPEG file]',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Type: application/octet-stream',
        'Content-Disposition: form-data; name="profile_picture"; filename="profile2.jpg"',
        '',
        '  [Some other binary data]',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Type: application/json',
        'Content-Disposition: form-data; name="metadata"',
        '',
        '{"age": 30, "location": "New York"}',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--'
    ].join('\r\n'));

    const parsedData = parseMultipartFormData<ParseResult>(testData, boundary, {
        'text/plain': content => decoder.decode(content).toUpperCase(),
        'image/jpeg': content => decoder.decode(content),
        'default':  content => decoder.decode(content).toUpperCase()
    })

    expect(parsedData.username.data).toBe('JOHN_DOE');
    expect(parsedData.username.contentType).toBe('text/plain');

    expect(parsedData.profile_picture[0].data).toEqual('  [Binary data of the JPEG file]');
    expect(parsedData.profile_picture[0].contentType).toBe('image/jpeg');
    expect(parsedData.profile_picture[0].filename).toBe('profile.jpg');

    expect(parsedData.profile_picture[1].data).toEqual('  [SOME OTHER BINARY DATA]');
    expect(parsedData.profile_picture[1].contentType).toBe('application/octet-stream');
    expect(parsedData.profile_picture[1].filename).toBe('profile2.jpg');

    expect(parsedData.metadata.data.age).toBe(30);
    expect(parsedData.metadata.data.location).toBe("New York");
});