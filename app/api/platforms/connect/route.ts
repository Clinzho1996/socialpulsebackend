import { verifyToken } from "@/lib/auth";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const OAUTH_CONFIGS = {
	twitter: {
		authUrl: "https://twitter.com/i/oauth2/authorize",
		scope: "tweet.read tweet.write users.read offline.access",
		envClientId: "TWITTER_CLIENT_ID",
		envClientSecret: "TWITTER_CLIENT_SECRET",
	},
	facebook: {
		authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
		scope: "pages_manage_posts,pages_read_engagement",
		envClientId: process.env.FACEBOOK_CLIENT_ID,
		envClientSecret: process.env.FACEBOOK_CLIENT_SECRET,
	},
	instagram: {
		authUrl: "https://api.instagram.com/oauth/authorize",
		scope: "user_profile,user_media",
		envClientId: "INSTAGRAM_CLIENT_ID",
		envClientSecret: "INSTAGRAM_CLIENT_SECRET",
	},
	linkedin: {
		authUrl: "https://www.linkedin.com/oauth/v2/authorization",
		scope: "w_member_social,r_liteprofile",
		envClientId: "LINKEDIN_CLIENT_ID",
		envClientSecret: "LINKEDIN_CLIENT_SECRET",
	},
	tiktok: {
		authUrl: "https://www.tiktok.com/auth/authorize/",
		scope: "user.info.basic,video.upload",
		envClientId: "TIKTOK_CLIENT_ID",
		envClientSecret: "TIKTOK_CLIENT_SECRET",
	},
} as const;

export async function POST(request: NextRequest) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "UNAUTHORIZED",
						message: "Authentication required",
					},
				},
				{ status: 401 }
			);
		}

		const { platform, redirectUri } = await request.json();

		if (!platform || !OAUTH_CONFIGS[platform as keyof typeof OAUTH_CONFIGS]) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid platform",
					},
				},
				{ status: 400 }
			);
		}

		const config = OAUTH_CONFIGS[platform as keyof typeof OAUTH_CONFIGS];
		const state = crypto.randomBytes(16).toString("hex");

		// ✅ FIX: Get client ID from correct environment variable (without VITE_)
		const clientId =
			process.env[config.envClientId as keyof typeof process.env];

		if (!clientId) {
			console.error(`Missing ${config.envClientId} environment variable`);
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "CONFIG_ERROR",
						message: `${platform} OAuth not configured. Check server environment variables.`,
					},
				},
				{ status: 500 }
			);
		}

		// Build OAuth URL
		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: config.scope,
			state,
		});

		const authUrl = `${config.authUrl}?${params.toString()}`;

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
				error: {
					code: "SERVER_ERROR",
					message: error.message,
				},
			},
			{ status: 500 }
		);
	}
}
