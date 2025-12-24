import { verifyToken } from "@/lib/auth";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Define the OAuth configurations
const OAUTH_CONFIGS = {
	twitter: {
		authUrl: "https://twitter.com/i/oauth2/authorize",
		tokenUrl: "https://api.twitter.com/2/oauth2/token",
		scope: "tweet.read tweet.write users.read offline.access",
		envVarName: "TWITTER_CLIENT_ID",
		requiresPKCE: true,
	},
	facebook: {
		authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
		scope: "public_profile,email",
		envVarName: "FACEBOOK_CLIENT_ID",
		requiresPKCE: false,
	},
	instagram: {
		authUrl: "https://api.instagram.com/oauth/authorize",
		scope: "user_profile,user_media",
		envVarName: "INSTAGRAM_CLIENT_ID",
		requiresPKCE: false,
	},
	linkedin: {
		authUrl: "https://www.linkedin.com/oauth/v2/authorization",
		scope: "w_member_social,r_liteprofile",
		envVarName: "LINKEDIN_CLIENT_ID",
		requiresPKCE: false,
	},
	tiktok: {
		authUrl: "https://www.tiktok.com/auth/authorize/",
		scope: "user.info.basic,video.upload",
		envVarName: "TIKTOK_CLIENT_ID",
		requiresPKCE: false,
	},
} as const;

// Helper function to generate PKCE code verifier and challenge
function generatePKCE() {
	// Generate code verifier (43-128 characters, a-z, A-Z, 0-9, -, ., _, ~)
	const codeVerifier = crypto.randomBytes(32).toString("base64url");

	// Generate code challenge (SHA256 of code verifier, then base64url)
	const codeChallenge = crypto
		.createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");

	return { codeVerifier, codeChallenge };
}

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
		const clientId = process.env[config.envVarName];

		if (!clientId) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "CONFIG_ERROR",
						message: `${platform} OAuth not configured. Missing ${config.envVarName}`,
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

		// Add PKCE parameters for Twitter/X
		let codeVerifier = null;
		if (config.requiresPKCE) {
			const pkce = generatePKCE();
			codeVerifier = pkce.codeVerifier;

			params.append("code_challenge", pkce.codeChallenge);
			params.append("code_challenge_method", "S256");
		}

		const authUrl = `${config.authUrl}?${params.toString()}`;

		// Prepare response data
		const responseData: any = {
			success: true,
			data: {
				authUrl,
				state,
			},
		};

		// Include code verifier in response if needed (store securely!)
		if (codeVerifier) {
			responseData.data.codeVerifier = codeVerifier;
			// IMPORTANT: In production, you should store this server-side
			// and associate it with the user/session
		}

		return NextResponse.json(responseData);
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
