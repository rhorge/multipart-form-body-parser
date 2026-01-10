import { readBoundary } from '../boundary';

test('retrieve boundary', () => {
    const testBoundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    let boundary = readBoundary(`multipart/form-data; boundary=${testBoundary}`);
    expect(boundary).toBe(testBoundary);

    boundary = readBoundary(`multipart/form-data; boundary="${testBoundary}"`);
    expect(boundary).toBe(testBoundary);

    boundary = readBoundary(`multipart/form-data; boundary="${testBoundary}";param=value`);
    expect(boundary).toBe(testBoundary);

    boundary = readBoundary(`multipart/form-data; boundary=${testBoundary};param=value`);
    expect(boundary).toBe(testBoundary);

    boundary = readBoundary(`multipart/form-data; boundary="${testBoundary}";param="value"`);
    expect(boundary).toBe(testBoundary);

    boundary = readBoundary(`multipart/form-data; boundary="${testBoundary};param="value"`);
    expect(boundary).toBe(`"${testBoundary}`);
});