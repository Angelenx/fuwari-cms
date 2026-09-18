import { env } from "cloudflare:workers";

/** Hard-coded single-admin username. The setup form never asks for it. */
export const ADMIN_USERNAME = "admin";

export const MIN_PASSWORD_LENGTH = 8;

export async function needsSetup(): Promise<boolean> {
	const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{
		n: number;
	}>();
	return (row?.n ?? 0) === 0;
}
