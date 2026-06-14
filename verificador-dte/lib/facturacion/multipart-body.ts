import { randomBytes } from 'crypto';

type MultipartFile = {
  fieldName: string;
  filename: string;
  content: Buffer;
  contentType?: string;
};

export function buildMultipartBody(
  fields: Record<string, string>,
  file: MultipartFile
): { body: Buffer; contentType: string } {
  const boundary = `----WebKitFormBoundary${randomBytes(16).toString('hex')}`;
  const crlf = '\r\n';
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}${crlf}` +
          `Content-Disposition: form-data; name="${name}"${crlf}${crlf}` +
          `${value}${crlf}`
      )
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"${crlf}` +
        `Content-Type: ${file.contentType || 'application/octet-stream'}${crlf}${crlf}`
    )
  );
  chunks.push(file.content);
  chunks.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
