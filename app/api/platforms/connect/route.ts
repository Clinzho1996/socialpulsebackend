import { verifyToken } from "@/lib/auth";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Define the OAuth configurations
const OAUTH_CONFIGS = {
	twitter: {
		authUrl: "https://twitter.com/i/oauth2/authorize",
		scope: "tweet.read tweet.write users.read offline.access",
		// Store the ENVIRONMENT VARIABLE NAME, not the value
		envVarName: "TWITTER_CLIENT_ID",
	},
	facebook: {
		authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
		scope: "public_profile,email",
		envVarName: "FACEBOOK_CLIENT_ID",
	},
	instagram: {
		authUrl: "https://api.instagram.com/oauth/authorize",
		scope: "user_profile,user_media",
		envVarName: "INSTAGRAM_CLIENT_ID",
	},
	linkedin: {
		authUrl: "https://www.linkedin.com/oauth/v2/authorization",
		scope: "w_member_social,r_liteprofile",
		envVarName: "LINKEDIN_CLIENT_ID",
	},
	tiktok: {
		authUrl: "https://www.tiktok.com/auth/authorize/",
		scope: "user.info.basic,video.upload",
		envVarName: "TIKTOK_CLIENT_ID",
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

		// ✅ CORRECT: Get client ID using the environment variable name
		const clientId = process.env[config.envVarName];

		// Debug logging
		console.log(`🔍 DEBUG for ${platform}:`);
		console.log(`  - envVarName: ${config.envVarName}`);
		console.log(`  - clientId exists: ${!!clientId}`);
		console.log(
			`  - clientId value: ${
				clientId ? `${clientId.substring(0, 10)}...` : "undefined"
			}`
		);
		console.log(`  - All FB env:`, {
			FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID ? "set" : "missing",
			FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET
				? "set"
				: "missing",
		});

		if (!clientId) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "CONFIG_ERROR",
						message: `${platform} OAuth not configured. Missing ${config.envVarName}`,
						debug: {
							envVarName: config.envVarName,
							availableEnvVars: Object.keys(process.env).filter(
								(key) => key.includes("FACEBOOK") || key.includes("CLIENT")
							),
						},
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
