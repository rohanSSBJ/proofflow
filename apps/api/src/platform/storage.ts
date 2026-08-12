import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';

const s3 = new S3Client({ region: env.S3_REGION });

function bucket() {
  if (!env.S3_BUCKET) {
    throw new Error('S3_BUCKET is not configured.');
  }
  return env.S3_BUCKET;
}

function safeFileName(originalName: string) {
  const normalized = originalName.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 120);
  return normalized || 'evidence-file';
}

export function evidenceObjectKey(input: { organizationId: string; taskId: string; originalName: string }) {
  return `evidence/${input.organizationId}/${input.taskId}/${randomUUID()}-${safeFileName(input.originalName)}`;
}

export async function presignEvidenceUpload(input: { objectKey: string; contentType: string }) {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: input.objectKey,
    ContentType: input.contentType,
    ServerSideEncryption: 'AES256'
  });
  return getSignedUrl(s3, command, { expiresIn: env.S3_PRESIGNED_URL_TTL_SECONDS });
}

export async function presignEvidenceDownload(objectKey: string) {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: objectKey });
  return getSignedUrl(s3, command, { expiresIn: env.S3_PRESIGNED_URL_TTL_SECONDS });
}

export async function headEvidenceObject(objectKey: string) {
  return s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: objectKey }));
}

export function storageUrlTtlSeconds() {
  return env.S3_PRESIGNED_URL_TTL_SECONDS;
}
