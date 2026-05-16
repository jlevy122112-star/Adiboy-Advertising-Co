/**
 * S3 storage helper — upload files and generate presigned download URLs.
 *
 * Reads credentials from environment:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION, AWS_S3_BUCKET
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "node:fs";
import { extname } from "node:path";

function makeClient(): S3Client {
  return new S3Client({
    region: process.env.AWS_S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function bucket(): string {
  const b = process.env.AWS_S3_BUCKET?.trim();
  if (!b) throw new Error("AWS_S3_BUCKET is not set");
  return b;
}

export type UploadResult =
  | { ok: true; key: string; url: string }
  | { ok: false; error: string };

/**
 * Upload a local file to S3. Returns the object key and a presigned URL
 * valid for 1 hour (used by FFmpeg to fetch images during video build).
 */
export async function uploadFileToS3(
  localPath: string,
  key: string,
): Promise<UploadResult> {
  try {
    const client = makeClient();
    const stream = createReadStream(localPath);
    const ext = extname(localPath).toLowerCase();
    const contentType = ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".png"
      ? "image/png"
      : ext === ".gif"
      ? "image/gif"
      : ext === ".mp4"
      ? "video/mp4"
      : "application/octet-stream";

    const upload = new Upload({
      client,
      params: {
        Bucket: bucket(),
        Key: key,
        Body: stream,
        ContentType: contentType,
      },
    });

    await upload.done();

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: 3600 },
    );

    return { ok: true, key, url };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}

/**
 * Upload a Buffer (e.g. an in-memory MP4) directly to S3.
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<UploadResult> {
  try {
    const client = makeClient();

    const upload = new Upload({
      client,
      params: {
        Bucket: bucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      },
    });

    await upload.done();

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: 3600 },
    );

    return { ok: true, key, url };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}

/** Generate a fresh presigned GET URL for an existing S3 object. */
export async function presignedGetUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = makeClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}

export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
    process.env.AWS_S3_BUCKET?.trim()
  );
}
