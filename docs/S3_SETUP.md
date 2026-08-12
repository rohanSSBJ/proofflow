# ProofFlow S3 setup

ProofFlow stores evidence metadata in PostgreSQL and evidence bytes in a private S3 bucket. The API uses the EC2 IAM role through the AWS SDK default credential chain; do not add AWS access keys to `.env`.

## Production values

```text
S3_BUCKET=proofflow-evidence-562325340757
S3_REGION=us-east-1
S3_PRESIGNED_URL_TTL_SECONDS=900
```

The EC2 role should allow only:

- `s3:ListBucket` for the `evidence/*` prefix;
- `s3:PutObject` and `s3:GetObject` below `arn:aws:s3:::proofflow-evidence-562325340757/evidence/*`.

Keep S3 Block Public Access enabled, use Bucket owner enforced object ownership, enable versioning, and use SSE-S3 default encryption.

## Browser CORS

When the frontend uploads directly to S3 with a presigned URL, configure the bucket's CORS section with the deployed application origin. Replace `https://app.example.com` with the actual ProofFlow origin; while using the current HTTP deployment, use its exact browser origin instead.

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "x-amz-server-side-encryption"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

The API endpoints are:

- `POST /api/v1/projects/:projectId/tasks/:taskId/evidence` — authorize metadata and return a short-lived PUT URL;
- `GET /api/v1/projects/:projectId/tasks/:taskId/evidence/:evidenceId/download-url` — authorize and return a short-lived GET URL.

Submission checks S3 object existence, content type, and byte size before creating the workflow submission. Malware scanning and quarantine promotion remain a later hardening step.
