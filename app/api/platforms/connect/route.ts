// /api/platforms/connect/route.ts
import { verifyToken } from "@/lib/auth";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const PLATFORM_CONFIGS = {
	twitter: {
		authUrl: "https://twitter.com/i/oauth2/authorize",
		scope: "tweet.read tweet.write users.read offline.access",
		clientId: process.env.TWITTER_CLIENT_ID,
	},
	facebook: {
		authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
		scope: "public_profile,email",
		clientId: process.env.FACEBOOK_CLIENT_ID,
	},
	// Add other platforms...
};

export async function POST(request: NextRequest) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			return NextResponse.json(
				{
					success: false,
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				},
				{ status: 401 }
			);
		}

		const { platform, redirectUri } = await request.json();

		if (
			!platform ||
			!PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS]
		) {
			return NextResponse.json(
				{
					success: false,
					error: { code: "VALIDATION_ERROR", message: "Invalid platform" },
				},
				{ status: 400 }
			);
		}

		const config = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS];

		if (!config.clientId) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "CONFIG_ERROR",
						message: `${platform} OAuth not configured`,
					},
				},
				{ status: 500 }
			);
		}

		const state = crypto.randomBytes(16).toString("hex");

		// For Twitter PKCE
		let authUrl = `${config.authUrl}?${new URLSearchParams({
			client_id: config.clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: config.scope,
			state,
		})}`;

		// Add PKCE for Twitter
		if (platform === "twitter") {
			const codeVerifier = crypto.randomBytes(32).toString("base64url");
			const codeChallenge = crypto
				.createHash("sha256")
				.update(codeVerifier)
				.digest("base64url");

			authUrl += `&code_challenge=${codeChallenge}&code_challenge_method=S256`;

			// Store codeVerifier with state (in practice, use a database or cache)
			// For now, we'll return it to the frontend
			return NextResponse.json({
				success: true,
				data: {
					authUrl,
					state,
					codeVerifier, // Frontend should store this and send back with callback
				},
			});
		}

		return NextResponse.json({
			success: true,
			data: {
				authUrl,
				state,
			},
		});
	} catch (error: any) {
		console.error("Platform connect error:", error);
		return NextResponse.json(
			{
				success: false,
				error: { code: "SERVER_ERROR", message: error.message },
			},
			{ status: 500 }
		);
	}
}
