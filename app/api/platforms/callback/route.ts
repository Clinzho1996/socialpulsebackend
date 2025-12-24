// /api/platforms/callback/route.ts
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

// Function to exchange code for access token
async function exchangeCodeForToken(
	platform: string,
	code: string,
	redirectUri: string
) {
	console.log(`🔄 Exchanging code for ${platform} token...`);

	switch (platform.toLowerCase()) {
		case "twitter":
			return await exchangeTwitterCode(code, redirectUri);
		// case "facebook":
		// 	return await exchangeFacebookCode(code, redirectUri);
		// case "instagram":
		// 	return await exchangeInstagramCode(code, redirectUri);
		// case "linkedin":
		// 	return await exchangeLinkedInCode(code, redirectUri);
		// case "tiktok":
		// 	return await exchangeTikTokCode(code, redirectUri);
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}
}

async function exchangeTwitterCode(code: string, redirectUri: string) {
	console.log("🔔 EXCHANGE_TWITTER_CODE CALLED");
	console.log(
		"📦 Code received (first 50 chars):",
		code.substring(0, 50) + "..."
	);
	console.log("🌐 Redirect URI:", redirectUri);

	const clientId = process.env.TWITTER_CLIENT_ID;
	const clientSecret = process.env.TWITTER_CLIENT_SECRET;

	console.log("🔑 Client ID exists:", !!clientId);
	console.log(
		"🔑 Client ID value:",
		clientId ? `${clientId.substring(0, 10)}...` : "missing"
	);
	console.log("🔑 Client Secret exists:", !!clientSecret);

	if (!clientId || !clientSecret) {
		console.error("❌ Twitter OAuth credentials missing");
		throw new Error("Twitter OAuth not configured");
	}

	// Prepare the request
	const params = new URLSearchParams({
		code,
		grant_type: "authorization_code",
		redirect_uri: redirectUri,
		client_id: clientId,
		code_verifier: "challenge", // This might be the issue!
	});

	console.log("📦 Request params:", {
		code_length: code.length,
		redirect_uri: redirectUri,
		client_id_length: clientId.length,
		has_code_verifier: true,
	});

	try {
		console.log("📞 Calling Twitter token endpoint...");
		console.log("🔗 URL: https://api.twitter.com/2/oauth2/token");

		const response = await fetch("https://api.twitter.com/2/oauth2/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(
					`${clientId}:${clientSecret}`
				).toString("base64")}`,
			},
			body: params,
		});

		console.log("📊 Twitter response status:", response.status);
		console.log(
			"📊 Twitter response headers:",
			Object.fromEntries(response.headers.entries())
		);

		const responseText = await response.text();
		console.log("📊 Twitter response text:", responseText);

		let data;
		try {
			data = JSON.parse(responseText);
			console.log("📊 Twitter parsed response:", data);
		} catch (e) {
			console.error(
				"❌ Failed to parse Twitter response as JSON:",
				responseText
			);
			throw new Error("Invalid response from Twitter");
		}

		if (!response.ok) {
			console.error("❌ Twitter token exchange failed:", data);
			throw new Error(
				data.error_description ||
					data.error ||
					`Twitter error: ${response.status}`
			);
		}

		console.log("✅ Twitter token exchange successful!");
		console.log("🔑 Access token received:", data.access_token ? "Yes" : "No");
		console.log("👤 Token type:", data.token_type);

		return {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
			expires_in: data.expires_in,
			token_type: data.token_type,
			user: {
				id: data.user_id, // Twitter might return user_id directly
			},
		};
	} catch (error: any) {
		console.error("💥 Twitter exchange error:", error);
		throw error;
	}
}

// Add similar functions for other platforms...

export async function POST(request: NextRequest) {
	console.log("🔔🔔🔔 CALLBACK ENDPOINT HIT!");
	console.log("📱 Request URL:", request.url);
	console.log("📦 Has body?", request.body ? "Yes" : "No");
	try {
		const user = await verifyToken(request);
		console.log("👤 User authenticated:", user ? `Yes (${user.userId})` : "No");
		if (!user) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "UNAUTHORIZED",
						message: "Authentication required",
					},
				},
				{
					status: 401,
				}
			);
		}

		const { platform, code, state, redirectUri } = await request.json();

		if (!platform || !code) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Platform and code are required",
					},
				},
				{
					status: 400,
				}
			);
		}

		console.log(`📱 Processing ${platform} callback for user ${user.userId}`);

		// IMPORTANT: Exchange code for actual access token
		const tokenData = await exchangeCodeForToken(
			platform,
			code,
			redirectUri || `${request.nextUrl.origin}/callback`
		);

		console.log(`✅ Token exchange successful for ${platform}:`, {
			hasAccessToken: !!tokenData.access_token,
			username: tokenData.user,
		});

		const { db } = await connectToDatabase();

		// Prepare actual platform data from OAuth response
		const platformData = {
			userId: user.userId, // Firebase UID as string (not ObjectId)
			name: platform.toLowerCase(),
			connected: true,
			username: tokenData.user || `@user_${platform}`,
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token || null,
			tokenExpiry: tokenData.expires_in
				? new Date(Date.now() + tokenData.expires_in * 1000)
				: new Date(Date.now() + 3600000),
			platformUserId: tokenData.user?.id,
			platformUserData: tokenData.user,
			limits: {
				postsPerHour: getPlatformLimit(platform, "hourly"),
				postsPerDay: getPlatformLimit(platform, "daily"),
			},
			connectedAt: new Date(),
			lastSyncAt: new Date(),
			updatedAt: new Date(),
		};

		// Check if platform already connected
		const existingPlatform = await db.collection("platforms").findOne({
			userId: user.userId, // String comparison for Firebase UID
			name: platform.toLowerCase(),
		});

		let savedPlatform;
		if (existingPlatform) {
			// Update existing
			await db
				.collection("platforms")
				.updateOne({ _id: existingPlatform._id }, { $set: platformData });
			savedPlatform = { ...platformData, _id: existingPlatform._id };
		} else {
			// Insert new
			const result = await db.collection("platforms").insertOne(platformData);
			savedPlatform = { ...platformData, _id: result.insertedId };
		}

		console.log(`✅ ${platform} saved to database for user ${user.userId}`);

		return NextResponse.json({
			success: true,
			data: {
				platform: {
					_id: savedPlatform._id.toString(),
					name: savedPlatform.name,
					connected: savedPlatform.connected,
					username: savedPlatform.username,
					platformUserId: savedPlatform.platformUserId,
					limits: savedPlatform.limits,
					connectedAt: savedPlatform.connectedAt,
				},
				message: `Successfully connected to ${platform}!`,
			},
		});
	} catch (error: any) {
		console.error("Platform callback error:", error);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message || "Internal server error",
				},
			},
			{
				status: 500,
			}
		);
	}
}

// Helper function for platform limits
function getPlatformLimit(platform: string, type: "hourly" | "daily"): number {
	const limits: Record<string, { hourly: number; daily: number }> = {
		twitter: { hourly: 5, daily: 20 },
		facebook: { hourly: 10, daily: 50 },
		instagram: { hourly: 3, daily: 10 },
		linkedin: { hourly: 2, daily: 10 },
		tiktok: { hourly: 4, daily: 15 },
	};

	return limits[platform.toLowerCase()]?.[type] || (type === "hourly" ? 5 : 20);
}
