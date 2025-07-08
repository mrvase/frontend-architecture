// Utility functions
const base64UrlEncode = (buffer: Uint8Array<ArrayBufferLike>) =>
  btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const base64UrlDecode = (str: string) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
};

const textToArrayBuffer = (str: string) => new TextEncoder().encode(str);
const arrayBufferToText = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer);

// Sign function
async function sign(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return `${value}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// Unsign function
async function unsign(input: string, secret: string) {
  const [value, signaturePart] = input.split(".");
  const expectedInput = await sign(value, secret);

  if (input === expectedInput) {
    return value;
  }
  throw new Error("Invalid signature");
}

// Encrypt function
async function encrypt(input: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    textToArrayBuffer(secret.padEnd(32, "\0").slice(0, 32)),
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    textToArrayBuffer(input)
  );
  return `${base64UrlEncode(new Uint8Array(encrypted))}.${base64UrlEncode(iv)}`;
}

// Decrypt function
async function decrypt(input: string, secret: string) {
  const [ciphertext, ivBase64] = input.split(".");
  const iv = base64UrlDecode(ivBase64);
  const key = await crypto.subtle.importKey(
    "raw",
    textToArrayBuffer(secret.padEnd(32, "\0").slice(0, 32)),
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    key,
    base64UrlDecode(ciphertext)
  );
  return arrayBufferToText(decrypted);
}

// Encode function
async function encode(
  value: any,
  options: { secret?: string; encrypt?: boolean } = {}
): Promise<string> {
  const { secret, encrypt: shouldEncrypt } = options;
  if (!secret) throw new Error("Missing secret");

  const stringified = JSON.stringify(value);
  const base64 = shouldEncrypt
    ? await encrypt(stringified, secret)
    : base64UrlEncode(textToArrayBuffer(stringified));

  return sign(base64, secret);
}

// Decode function
async function decode<T>(
  value: string,
  options: { secret?: string; decrypt?: boolean } = {}
): Promise<T | null> {
  const { secret, decrypt: shouldDecrypt } = options;
  if (!secret) throw new Error("Missing secret");

  try {
    const unsigned = await unsign(value, secret);
    const base64Decoded = shouldDecrypt
      ? await decrypt(unsigned, secret)
      : arrayBufferToText(base64UrlDecode(unsigned).buffer);

    return JSON.parse(base64Decoded);
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Export the functions
export { sign, unsign, encrypt, decrypt, encode, decode };
