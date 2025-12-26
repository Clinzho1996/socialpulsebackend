import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

/* ================================
   Type Definitions
================================ */
interface OAuthTokenData {
	accessToken: string;
	refreshToken: string | null;
	expiresIn: number;
	tokenType: string;
	user: {
		id: string;
		username?: string | null;
		name?: string | null;
		email?: string | null;
		profileImageUrl?: string | null;
		followersCount?: number;
		followingCount?: number;
		// Twitter specific
		tweetCount?: number;
		// Facebook specific
		pages?: any[];
		// Instagram specific
		accountType?: string;
		mediaCount?: number;
		// TikTok specific
		likesCount?: number;
		videoCount?: number;
		// LinkedIn specific
		givenName?: string;
		familyName?: string;
	};
}

interface PlatformRecord {
	userId: string;
	platform: string;
	name: string;
	connected: boolean;
	username: string | null;
	accessToken: string;
	refreshToken: string | null;
	tokenExpiry: Date | null;
	platformUserId: string | null;
	platformData: {
		name?: string | null;
		email?: string | null;
		profileImageUrl?: string | null;
		followersCount: number;
		followingCount: number;
		// Platform-specific optional fields
		pages?: any[];
		accountType?: string;
		mediaCount?: number;
		likesCount?: number;
		videoCount?: number;
		givenName?: string;
		familyName?: string;
		tweetCount?: number;
	};
	connectedAt: Date;
	updatedAt: Date;
}

/* ================================
   Twitter Token Exchange
================================ */
async function exchangeTwitterCode(
	code: string,
	redirectUri: string,
	codeVerifier: string
): Promise<OAuthTokenData> {
	console.log("🔔 Twitter token exchange started");

	const clientId = process.env.TWITTER_CLIENT_ID;
	const clientSecret = process.env.TWITTER_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("Twitter OAuth credentials are missing");
	}

	const params = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: clientId,
		code_verifier: codeVerifier,
	});

	const response = await fetch("https://api.twitter.com/2/oauth2/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${Buffer.from(
				`${clientId}:${clientSecret}`
			).toString("base64")}`,
		},
		body: params.toString(),
	});

	const raw = await response.text();
	let data: any;
	try {
		data = JSON.parse(raw);
	} catch {
		throw new Error("Invalid response from Twitter token endpoint");
	}

	if (!response.ok) {
		console.error("❌ Twitter token exchange failed:", data);
		throw new Error(
			data.error_description || data.error || "Twitter token exchange failed"
		);
	}

	// Fetch user profile with public metrics for follower count
	const userResponse = await fetch(
		"https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url",
		{
			headers: {
				Authorization: `Bearer ${data.access_token}`,
			},
		}
	);

	const userData = await userResponse.json();
	console.log("📊 Twitter user data:", userData);

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token || null,
		expiresIn: data.expires_in,
		tokenType: data.token_type,
		user: {
			id: data.user_id || userData.data?.id,
			username: data.username || userData.data?.username || null,
			name: userData.data?.name || null,
			profileImageUrl: userData.data?.profile_image_url || null,
			followersCount: userData.data?.public_metrics?.followers_count || 0,
			followingCount: userData.data?.public_metrics?.following_count || 0,
			tweetCount: userData.data?.public_metrics?.tweet_count || 0,
		},
	};
}

/* ================================
   Facebook Token Exchange
================================ */
async function exchangeFacebookCode(
	code: string,
	redirectUri: string
): Promise<OAuthTokenData> {
	console.log("🔔 Facebook token exchange started");

	const clientId = process.env.FACEBOOK_CLIENT_ID;
	const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("Facebook OAuth credentials are missing");
	}

	const params = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uri: redirectUri,
		code,
		grant_type: "authorization_code",
	});

	const response = await fetch(
		"https://graph.facebook.com/v19.0/oauth/access_token",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: params.toString(),
		}
	);

	const data = await response.json();

	if (!response.ok || data.error) {
		console.error("❌ Facebook token exchange failed:", data);
		throw new Error(data.error?.message || "Facebook token exchange failed");
	}

	// Fetch user profile
	const userResponse = await fetch(
		`https://graph.facebook.com/v19.0/me?fields=id,name,email,picture{url}&access_token=${data.access_token}`
	);
	const userData = await userResponse.json();

	// Fetch pages if user has any
	let pages: any[] = [];
	try {
		const pagesResponse = await fetch(
			`https://graph.facebook.com/v19.0/me/accounts?access_token=${data.access_token}`
		);
		const pagesData = await pagesResponse.json();
		pages = pagesData.data || [];
	} catch (error) {
		console.log("No Facebook pages found or error fetching pages");
	}

	return {
		accessToken: data.access_token,
		refreshToken: data.access_token,
		expiresIn: data.expires_in,
		tokenType: "bearer",
		user: {
			id: userData.id,
			username: userData.name || null,
			name: userData.name,
			email: userData.email || null,
			profileImageUrl: userData.picture?.data?.url || null,
			pages: pages,
		},
	};
}

/* ================================
   Instagram Token Exchange
================================ */
async function exchangeInstagramCode(
	code: string,
	redirectUri: string
): Promise<OAuthTokenData> {
	console.log("🔔 Instagram token exchange started");

	const clientId = process.env.INSTAGRAM_CLIENT_ID;
	const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("Instagram OAuth credentials are missing");
	}

	const params = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: "authorization_code",
		redirect_uri: redirectUri,
		code,
	});

	const response = await fetch("https://api.instagram.com/oauth/access_token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params.toString(),
	});

	const data = await response.json();

	if (!response.ok || data.error) {
		console.error("❌ Instagram token exchange failed:", data);
		throw new Error(
			data.error_message ||
				data.error?.message ||
				"Instagram token exchange failed"
		);
	}

	// For Instagram Graph API (Business/Creator accounts)
	let userProfile: any = null;
	try {
		const userResponse = await fetch(
			`https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${data.access_token}`
		);
		userProfile = await userResponse.json();
	} catch (error) {
		console.log("Using Instagram Basic Display API");
	}

	return {
		accessToken: data.access_token,
		refreshToken: null,
		expiresIn: data.expires_in || 5184000,
		tokenType: "bearer",
		user: {
			id: userProfile?.id || data.user_id,
			username: userProfile?.username || data.username || null,
			name: userProfile?.username || data.username || null,
			accountType: userProfile?.account_type || "basic",
			mediaCount: userProfile?.media_count || 0,
		},
	};
}

/* ================================
   TikTok Token Exchange
================================ */
async function exchangeTikTokCode(
	code: string,
	redirectUri: string,
	codeVerifier: string
): Promise<OAuthTokenData> {
	console.log("🔔 TikTok token exchange started");

	const clientId = process.env.TIKTOK_CLIENT_ID;
	const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("TikTok OAuth credentials are missing");
	}

	const params = new URLSearchParams({
		client_key: clientId,
		client_secret: clientSecret,
		code,
		grant_type: "authorization_code",
		redirect_uri: redirectUri,
		code_verifier: codeVerifier,
	});

	const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Cache-Control": "no-cache",
		},
		body: params.toString(),
	});

	const data = await response.json();

	if (!response.ok || data.error) {
		console.error("❌ TikTok token exchange failed:", data);
		throw new Error(
			data.error_description ||
				data.error?.message ||
				"TikTok token exchange failed"
		);
	}

	// Fetch user info
	const userResponse = await fetch(
		"https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count",
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${data.access_token}`,
			},
		}
	);

	const userData = await userResponse.json();

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token || null,
		expiresIn: data.expires_in,
		tokenType: data.token_type,
		user: {
			id: userData.data?.user?.open_id || data.open_id,
			username: userData.data?.user?.display_name || null,
			name: userData.data?.user?.display_name || null,
			profileImageUrl: userData.data?.user?.avatar_url || null,
			followersCount: userData.data?.user?.follower_count || 0,
			followingCount: userData.data?.user?.following_count || 0,
			likesCount: userData.data?.user?.likes_count || 0,
			videoCount: userData.data?.user?.video_count || 0,
		},
	};
}

/* ================================
   LinkedIn Token Exchange
================================ */
async function exchangeLinkedInCode(
	code: string,
	redirectUri: string
): Promise<OAuthTokenData> {
	console.log("🔔 LinkedIn token exchange started");

	const clientId = process.env.LINKEDIN_CLIENT_ID;
	const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("LinkedIn OAuth credentials are missing");
	}

	const params = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: clientId,
		client_secret: clientSecret,
	});

	const response = await fetch(
		"https://www.linkedin.com/oauth/v2/accessToken",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: params.toString(),
		}
	);

	const data = await response.json();

	if (!response.ok || data.error) {
		console.error("❌ LinkedIn token exchange failed:", data);
		throw new Error(
			data.error_description ||
				data.error?.message ||
				"LinkedIn token exchange failed"
		);
	}

	// Fetch user profile
	const userResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
		headers: {
			Authorization: `Bearer ${data.access_token}`,
		},
	});

	const userData = await userResponse.json();

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token || null,
		expiresIn: data.expires_in,
		tokenType: data.token_type,
		user: {
			id: userData.sub,
			username: userData.name || null,
			name: userData.name,
			email: userData.email || null,
			profileImageUrl: userData.picture || null,
			givenName: userData.given_name,
			familyName: userData.family_name,
		},
	};
}

/* ================================
   Platform Configurations
================================ */
interface PlatformConfig {
	name: string;
	requiresPKCE: boolean;
	exchange: (
		code: string,
		redirectUri: string,
		codeVerifier: string
	) => Promise<OAuthTokenData>;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
	twitter: {
		name: "Twitter",
		requiresPKCE: true,
		exchange: exchangeTwitterCode,
	},
	facebook: {
		name: "Facebook",
		requiresPKCE: false,
		exchange: exchangeFacebookCode,
	},
	instagram: {
		name: "Instagram",
		requiresPKCE: false,
		exchange: exchangeInstagramCode,
	},
	tiktok: {
		name: "TikTok",
		requiresPKCE: true,
		exchange: exchangeTikTokCode,
	},
	linkedin: {
		name: "LinkedIn",
		requiresPKCE: false,
		exchange: exchangeLinkedInCode,
	},
};

/* ================================
   Main Callback Handler
================================ */
export async function POST(request: NextRequest) {
	console.log("🔔 OAuth CALLBACK HIT");

	try {
		/* -------- Auth -------- */
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

		/* -------- Body -------- */
		const { platform, code, state, redirectUri, codeVerifier } =
			await request.json();

		if (!platform || !code) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Platform and code are required",
					},
				},
				{ status: 400 }
			);
		}

		const platformConfig =
			PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS];

		if (!platformConfig) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "INVALID_PLATFORM",
						message: `Unsupported platform: ${platform}`,
					},
				},
				{ status: 400 }
			);
		}

		if (platformConfig.requiresPKCE && !codeVerifier) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "PKCE_REQUIRED",
						message: `PKCE code verifier is required for ${platform}`,
					},
				},
				{ status: 400 }
			);
		}

		console.log(`📱 Processing ${platform} for user ${user.userId}`);

		/* -------- Exchange Token -------- */
		let tokenData: OAuthTokenData;

		if (platformConfig.requiresPKCE) {
			tokenData = await platformConfig.exchange(
				code,
				redirectUri,
				codeVerifier
			);
		} else {
			tokenData = await platformConfig?.exchange(code, redirectUri, "");
		}

		/* -------- Database -------- */
		const { db } = await connectToDatabase();
		const now = new Date();

		// Create platformData object with type-safe spread operations
		const platformData: PlatformRecord["platformData"] = {
			name: tokenData.user?.name ?? null,
			email: tokenData.user?.email ?? null,
			profileImageUrl: tokenData.user?.profileImageUrl ?? null,
			followersCount: tokenData.user?.followersCount ?? 0,
			followingCount: tokenData.user?.followingCount ?? 0,
		};

		// Add platform-specific data safely
		if (platform === "facebook") {
			platformData.pages = tokenData.user?.pages ?? [];
		}
		if (platform === "instagram") {
			platformData.accountType = tokenData.user?.accountType ?? "basic";
			platformData.mediaCount = tokenData.user?.mediaCount ?? 0;
		}
		if (platform === "tiktok") {
			platformData.likesCount = tokenData.user?.likesCount ?? 0;
			platformData.videoCount = tokenData.user?.videoCount ?? 0;
		}
		if (platform === "linkedin") {
			platformData.givenName = tokenData.user?.givenName;
			platformData.familyName = tokenData.user?.familyName;
		}
		if (platform === "twitter") {
			platformData.tweetCount = tokenData.user?.tweetCount ?? 0;
		}

		const platformRecord: PlatformRecord = {
			userId: user.userId,
			platform: platform.toLowerCase(),
			name: platformConfig.name,
			connected: true,
			username: tokenData.user?.username ?? tokenData.user?.name ?? null,
			accessToken: tokenData.accessToken,
			refreshToken: tokenData.refreshToken,
			tokenExpiry: tokenData.expiresIn
				? new Date(Date.now() + tokenData.expiresIn * 1000)
				: null,
			platformUserId: tokenData.user?.id ?? null,
			platformData,
			connectedAt: now,
			updatedAt: now,
		};

		const existing = await db.collection("platforms").findOne({
			userId: user.userId,
			platform: platform.toLowerCase(),
		});

		let savedId;

		if (existing) {
			const update = await db
				.collection("platforms")
				.updateOne({ _id: existing._id }, { $set: platformRecord });

			if (!update.acknowledged) {
				throw new Error("Failed to update platform record");
			}

			savedId = existing._id;
		} else {
			const insert = await db.collection("platforms").insertOne(platformRecord);

			if (!insert.acknowledged) {
				throw new Error("Failed to save platform record");
			}

			savedId = insert.insertedId;
		}

		console.log(`✅ ${platform} persisted for user ${user.userId}`);

		/* -------- Response -------- */
		const responseData = {
			platform: {
				_id: savedId.toString(),
				platform: platform.toLowerCase(),
				name: platformConfig.name,
				username: platformRecord.username,
				connected: true,
				connectedAt: platformRecord.connectedAt,
				followersCount: tokenData.user?.followersCount ?? 0,
				profileImageUrl: tokenData.user?.profileImageUrl ?? null,
				platformData: platformRecord.platformData,
			},
			message: `Successfully connected to ${platformConfig.name}`,
		};

		return NextResponse.json({
			success: true,
			data: responseData,
		});
	} catch (error: any) {
		console.error("❌ OAuth callback error:", error);

		// Provide more specific error messages
		let errorCode = "SERVER_ERROR";
		let errorMessage = error.message || "Internal server error";

		if (error.message.includes("credentials are missing")) {
			errorCode = "CONFIG_ERROR";
			errorMessage = "Platform OAuth credentials not configured";
		} else if (error.message.includes("token exchange failed")) {
			errorCode = "OAUTH_ERROR";
		} else if (error.message.includes("PKCE")) {
			errorCode = "PKCE_REQUIRED";
		}

		return NextResponse.json(
			{
				success: false,
				error: {
					code: errorCode,
					message: errorMessage,
					details:
						process.env.NODE_ENV === "development" ? error.stack : undefined,
				},
			},
			{ status: 500 }
		);
	}
}
