// Finds the storage settings Vercel adds when a database or Blob store is connected.
// Vercel may name them with a prefix chosen at connect time (e.g. STORAGE_DATABASE_URL),
// so look for the usual names first, then for any name ending the same way.

function findByEnding(endings: string[], accept: (v: string) => boolean = () => true): string | undefined {
  const keys = Object.keys(process.env).sort();
  for (const end of endings) {
    for (const k of keys) {
      const v = process.env[k];
      if (v && k.endsWith(end) && accept(v)) return v;
    }
  }
  return undefined;
}

export function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    findByEnding(["_DATABASE_URL", "_POSTGRES_URL"], (v) => v.startsWith("postgres"))
  );
}

export function blobToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    findByEnding(["_READ_WRITE_TOKEN"], (v) => v.startsWith("vercel_blob_rw_"))
  );
}

/** Newer Blob stores connect without a token: Vercel signs requests itself (OIDC) and gives the store id. */
export function blobStoreId(): string | undefined {
  return process.env.BLOB_STORE_ID || findByEnding(["_STORE_ID"], (v) => v.startsWith("store_"));
}

export const blobConfigured = () => Boolean(blobToken() || blobStoreId());

export const onVercel = () => Boolean(process.env.VERCEL);
