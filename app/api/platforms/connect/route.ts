// /api/platforms/connect/route.ts
import { verifyToken } from "@/lib/auth";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const PLATFORM_CONFIGS = {
	twitter: {
		authUrl: "https://twitter.com/i/oauth2/authorize",
		// Updated Twitter scopes for follower data
		scope: "users.read tweet.read tweet.write follows.read offline.access",
		clientId: process.env.TWITTER_CLIENT_ID,
		tokenUrl: "https://api.twitter.com/2/oauth2/token",
		apiBase: "https://api.twitter.com/2",
	},
	facebook: {
		authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
		scope: "public_profile,email,pages_show_list,pages_read_engagement",
		clientId: process.env.FACEBOOK_CLIENT_ID,
		tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
		apiBase: "https://graph.facebook.com/v19.0",
	},
	instagram: {
		authUrl: "https://api.instagram.com/oauth/authorize",
		scope: "user_profile,user_media,instagram_basic,instagram_content_publish",
		clientId: process.env.INSTAGRAM_CLIENT_ID,
		tokenUrl: "https://api.instagram.com/oauth/access_token",
		apiBase: "https://graph.instagram.com",
		// Note: Instagram requires Facebook App review for most scopes
	},
	tiktok: {
		authUrl: "https://www.tiktok.com/v2/auth/authorize/",
		scope: "user.info.basic,video.list,video.publish",
		clientId: process.env.TIKTOK_CLIENT_ID,
		tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
		apiBase: "https://open.tiktokapis.com/v2",
		requiresPKCE: true,
	},
	linkedin: {
		authUrl: "https://www.linkedin.com/oauth/v2/authorization",
		scope: "r_liteprofile r_emailaddress w_member_social",
		clientId: process.env.LINKEDIN_CLIENT_ID,
		tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
		apiBase: "https://api.linkedin.com/v2",
	},
} as const;

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
		const codeVerifier = crypto.randomBytes(32).toString("base64url");

		// Base parameters for all platforms
		const params: Record<string, string> = {
			client_id: config.clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: config.scope,
			state,
		};

		// Platform-specific parameters
		switch (platform) {
			case "twitter":
				// PKCE required for Twitter
				const codeChallenge = crypto
					.createHash("sha256")
					.update(codeVerifier)
					.digest("base64url");
				params.code_challenge = codeChallenge;
				params.code_challenge_method = "S256";
				break;

			case "tiktok":
				// TikTok also requires PKCE
				const tiktokCodeChallenge = crypto
					.createHash("sha256")
					.update(codeVerifier)
					.digest("base64url");
				params.code_challenge = tiktokCodeChallenge;
				params.code_challenge_method = "S256";
				break;

			case "facebook":
				params.display = "popup";
				break;

			case "instagram":
				// Instagram uses slightly different parameter names
				delete params.response_type;
				params.response_type = "code";
				break;

			case "linkedin":
				// No additional params needed
				break;
		}

		const authUrl = `${config.authUrl}?${new URLSearchParams(params)}`;

		// Store the code verifier for platforms that need it
		const needsCodeVerifier = platform === "twitter" || platform === "tiktok";

		return NextResponse.json({
			success: true,
			data: {
				authUrl,
				state,
				...(needsCodeVerifier && { codeVerifier }),
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
