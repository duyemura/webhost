import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { config } from "../config.js";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${config.cloudflare.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.cloudflare.r2AccessKeyId,
    secretAccessKey: config.cloudflare.r2SecretKey,
  },
});

const Bucket = config.cloudflare.r2Bucket;

export async function putFile(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function deletePrefix(prefix: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const list = await r2.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    const objects = list.Contents?.map((o) => ({ Key: o.Key! })) ?? [];
    if (objects.length > 0) {
      await r2.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: objects } }));
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}

