# File Uploads

File uploads are handled by the `fileStorage` adapter. When configured, visitors and agents can share files during chat sessions.

## FileStorage Adapter Interface

```ts
fileStorage: {
  upload(file: Buffer, fileName: string, mimeType: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
}
```

| Method | Required | Description |
|--------|----------|-------------|
| `upload` | Yes | Store a file buffer and return a URL |
| `delete` | Yes | Delete a file by its URL |
| `getSignedUrl` | No | Generate a time-limited URL for private files |

## S3 Adapter Example

```ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET!;

const s3FileStorage = {
  async upload(file: Buffer, fileName: string, mimeType: string) {
    const key = `chat-uploads/${crypto.randomUUID()}-${fileName}`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file,
      ContentType: mimeType,
    }));
    return `https://${BUCKET}.s3.amazonaws.com/${key}`;
  },

  async delete(fileUrl: string) {
    const key = new URL(fileUrl).pathname.slice(1);
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  },

  async getSignedUrl(fileUrl: string, expiresIn = 3600) {
    const key = new URL(fileUrl).pathname.slice(1);
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
  },
};

const engine = createChatEngine({
  // ...
  adapters: { fileStorage: s3FileStorage },
});
```

## GCS Adapter Example

```ts
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

const storage = new Storage();
const BUCKET = process.env.GCS_BUCKET!;

const gcsFileStorage = {
  async upload(file: Buffer, fileName: string, mimeType: string) {
    const destName = `chat-uploads/${crypto.randomUUID()}-${fileName}`;
    const bucket = storage.bucket(BUCKET);
    const blob = bucket.file(destName);

    await blob.save(file, { contentType: mimeType });
    return `https://storage.googleapis.com/${BUCKET}/${destName}`;
  },

  async delete(fileUrl: string) {
    const path = new URL(fileUrl).pathname.split(`${BUCKET}/`)[1];
    await storage.bucket(BUCKET).file(path).delete();
  },

  async getSignedUrl(fileUrl: string, expiresIn = 3600) {
    const path = new URL(fileUrl).pathname.split(`${BUCKET}/`)[1];
    const [url] = await storage.bucket(BUCKET).file(path).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    return url;
  },
};
```

## Local Disk Adapter Example

```ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve('./uploads/chat');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const localFileStorage = {
  async upload(file: Buffer, fileName: string, _mimeType: string) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const safeName = `${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    await fs.writeFile(filePath, file);
    return `${BASE_URL}/uploads/chat/${safeName}`;
  },

  async delete(fileUrl: string) {
    const fileName = new URL(fileUrl).pathname.split('/').pop()!;
    await fs.unlink(path.join(UPLOAD_DIR, fileName)).catch(() => {});
  },
};
```

When using local disk, serve the upload directory as static files:

```ts
app.use('/uploads/chat', express.static(UPLOAD_DIR));
```

## Admin Controls

File sharing is controlled via the `fileSharing` section of chat settings:

```ts
// PUT /api/chat/settings
{
  "fileSharing": {
    "enabled": true,          // default: false
    "maxFileSizeMb": 10,      // default: 5
    "allowedTypes": [          // default: ['image/*', 'application/pdf']
      "image/*",
      "application/pdf",
      "text/plain"
    ]
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `false` | Master toggle for file sharing |
| `maxFileSizeMb` | `5` | Maximum file size in MB |
| `allowedTypes` | `['image/*', 'application/pdf']` | MIME type patterns (supports wildcards like `image/*`) |

## Upload Route

`POST /sessions/:sessionId/upload` handles file uploads via multipart/form-data.

**Prerequisites:**
1. `fileStorage` adapter must be configured
2. `fileSharing.enabled` must be `true` in settings
3. Your Express app must use `multer` or similar middleware for multipart parsing

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://bucket.s3.amazonaws.com/chat-uploads/abc-123-photo.jpg",
    "fileName": "photo.jpg",
    "mimeType": "image/jpeg",
    "size": 245760
  }
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| `501` | File storage not configured |
| `403` | File sharing is disabled |
| `413` | File exceeds max size |
| `415` | File type not allowed |

## How File Messages Work

1. Client uploads file via `POST /sessions/:sessionId/upload` and receives a URL
2. Client sends a message via WebSocket with `contentType: 'file'` and the URL as `content`
3. The engine validates the URL and broadcasts the file message to the agent
4. Agents see the file as a clickable link or inline preview (depending on the widget)
