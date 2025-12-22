// lib/auth.ts in your Next.js backend
import { NextRequest } from "next/server";

export interface VerifiedUser {
	userId: string;
	email: string;
	emailVerified: boolean;
	displayName?: string;
}

// Firebase project ID from environment
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

// Cache for verified tokens to reduce API calls
const tokenCache = new Map<string, { user: VerifiedUser; expiresAt: number }>();

export async function verifyToken(
	request: NextRequest
): Promise<VerifiedUser | null> {
	try {
		// Get token from Authorization header
		const authHeader = request.headers.get("authorization");

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("No Authorization header found");
			return null;
		}

		const token = authHeader.split("Bearer ")[1];

		if (!token || token === "null" || token === "undefined") {
			console.log("Invalid token format");
			return null;
		}

		// Check cache first
		const cached = tokenCache.get(token);
		if (cached && cached.expiresAt > Date.now()) {
			console.log("Using cached token verification");
			return cached.user;
		}

		// Validate token using Firebase REST API
		const response = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ idToken: token }),
			}
		);

		if (!response.ok) {
			console.error("Firebase token validation failed:", response.status);
			return null;
		}

		const data = await response.json();

		if (!data.users || data.users.length === 0) {
			console.error("No user found in Firebase response");
			return null;
		}

		const firebaseUser = data.users[0];

		const verifiedUser: VerifiedUser = {
			userId: firebaseUser.localId,
			email: firebaseUser.email || "",
			emailVerified: firebaseUser.emailVerified || false,
			displayName: firebaseUser.displayName,
		};

		// Cache the token for 5 minutes
		tokenCache.set(token, {
			user: verifiedUser,
			expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
		});

		console.log("✅ Token verified for user:", verifiedUser.email);

		return verifiedUser;
	} catch (error: any) {
		console.error("Token verification error:", error.message);
		return null;
	}
}

// Alternative: Validate token locally (no API call)
// Only works if you don't need to check token revocation
export async function verifyTokenLocal(
	request: NextRequest
): Promise<VerifiedUser | null> {
	try {
		const authHeader = request.headers.get("authorization");

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return null;
		}

		const token = authHeader.split("Bearer ")[1];

		if (!token) {
			return null;
		}

		// Simple JWT decode (without signature verification)
		// WARNING: This doesn't verify the token signature, only for development!
		const parts = token.split(".");
		if (parts.length !== 3) {
			return null;
		}

		const payload = JSON.parse(
			Buffer.from(parts[1], "base64").toString("utf-8")
		);

		// Check if token is expired
		if (payload.exp && payload.exp * 1000 < Date.now()) {
			console.log("Token expired");
			return null;
		}

		// Check audience
		if (payload.aud !== FIREBASE_PROJECT_ID) {
			console.log("Invalid audience");
			return null;
		}

		const verifiedUser: VerifiedUser = {
			userId: payload.user_id || payload.sub,
			email: payload.email || "",
			emailVerified: payload.email_verified || false,
			displayName: payload.name,
		};

		console.log("✅ Local token verification for user:", verifiedUser.email);

		return verifiedUser;
	} catch (error) {
		console.error("Local token verification error:", error);
		return null;
	}
}
