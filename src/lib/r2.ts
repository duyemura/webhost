import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
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

export async function getFile(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return {
      body: Buffer.concat(chunks),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export async function deleteFile(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket, Key: key }));
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

export async function copyPrefix(srcPrefix: string, dstPrefix: string): Promise<number> {
  const srcFiles = await listFiles(srcPrefix);

  // Copy all source files to destination
  await Promise.all(
    srcFiles.map((f) => {
      const dstKey = dstPrefix + f.key.slice(srcPrefix.length);
      return r2.send(
        new CopyObjectCommand({ Bucket, CopySource: `${Bucket}/${f.key}`, Key: dstKey })
      );
    })
  );

  // Delete destination files that no longer exist in source
  const srcKeys = new Set(srcFiles.map((f) => dstPrefix + f.key.slice(srcPrefix.length)));
  const dstFiles = await listFiles(dstPrefix);
  const toDelete = dstFiles.filter((f) => !srcKeys.has(f.key));
  if (toDelete.length > 0) {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: toDelete.map((f) => ({ Key: f.key })) },
      })
    );
  }

  return srcFiles.length;
}

export async function listFiles(prefix: string): Promise<{ key: string; size: number }[]> {
  const results: { key: string; size: number }[] = [];
  let continuationToken: string | undefined;
  do {
    const list = await r2.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    for (const obj of list.Contents ?? []) {
      if (obj.Key && !obj.Key.endsWith("/")) {
        results.push({ key: obj.Key, size: obj.Size ?? 0 });
      }
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
  return results;
}
