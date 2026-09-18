/**
 * PBKDF2-SHA256 password hashes for the single admin account.
 * Format: pbkdf2$sha256$<iterations>$<b64url-salt>$<b64url-dk>
 */

const encoder = new TextEncoder();

// ponytail: 100k is the practical SubtleCrypto ceiling on Workers; bump iterations
// or swap the algorithm in this module only if CPU budget grows.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DK_BITS = 256;

let dummyHashPromise: Promise<string> | undefined;

function b64urlEncode(bytes: Uint8Array<ArrayBuffer>): string {
	let bin = "";
	for (const byte of bytes) {
		bin += String.fromCharCode(byte);
	}
	return btoa(bin)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function b64urlDecode(value: string): Uint8Array<ArrayBuffer> | undefined {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const pad = (4 - (padded.length % 4)) % 4;
	try {
		const bin = atob(padded + "=".repeat(pad));
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) {
			out[i] = bin.charCodeAt(i);
		}
		return out;
	} catch {
		return undefined;
	}
}

function timingSafeEqual(
	a: Uint8Array<ArrayBuffer>,
	b: Uint8Array<ArrayBuffer>,
): boolean {
	if (a.byteLength !== b.byteLength) {
		return false;
	}
	// Workers non-standard extension; typed as SubtleCrypto in docs, not in lib.dom.
	return (
		crypto.subtle as unknown as {
			timingSafeEqual(x: BufferSource, y: BufferSource): boolean;
		}
	).timingSafeEqual(a, b);
}

async function deriveBits(
	password: string,
	salt: Uint8Array<ArrayBuffer>,
	iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt,
			iterations,
		},
		keyMaterial,
		DK_BITS,
	);
	return new Uint8Array(bits);
}

type ParsedHash = {
	iterations: number;
	salt: Uint8Array<ArrayBuffer>;
	dk: Uint8Array<ArrayBuffer>;
};

function parseHash(stored: string): ParsedHash | undefined {
	const parts = stored.split("$");
	if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
		return undefined;
	}
	const iterations = Number(parts[2]);
	if (!Number.isInteger(iterations) || iterations < 1) {
		return undefined;
	}
	const salt = b64urlDecode(parts[3]);
	const dk = b64urlDecode(parts[4]);
	if (!salt || !dk || salt.byteLength === 0 || dk.byteLength === 0) {
		return undefined;
	}
	return { iterations, salt, dk };
}

/** Hash a password for INSERT into users.password_hash. */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const dk = await deriveBits(password, salt, ITERATIONS);
	return `pbkdf2$sha256$${ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(dk)}`;
}

/**
 * Verify `password` against a stored hash.
 * Pass `undefined` when the username is unknown so the caller still pays PBKDF2.
 */
export async function verifyPassword(
	password: string,
	stored: string | undefined,
): Promise<boolean> {
	const target = stored ?? (await dummyPasswordHash());
	const parsed = parseHash(target);
	if (!parsed) {
		return false;
	}
	const dk = await deriveBits(password, parsed.salt, parsed.iterations);
	return timingSafeEqual(dk, parsed.dk);
}

async function dummyPasswordHash(): Promise<string> {
	dummyHashPromise ??= hashPassword(`unusable-${crypto.randomUUID()}`);
	return dummyHashPromise;
}
