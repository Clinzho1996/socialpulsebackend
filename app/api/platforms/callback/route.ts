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
				id: data.user_id,
				username: data.screen_name,
			},
		};
	} catch (error: any) {
		console.error("💥 Twitter exchange error:", error);
		throw error;
	}
}

// Add similar functions for other platforms...

// /api/platforms/callback/route.ts - Updated with detailed logging
export async function POST(request: NextRequest) {
	console.log("🔔🔔🔔 CALLBACK ENDPOINT HIT!");
	console.log("📱 Request URL:", request.url);
	console.log("📦 Request method:", request.method);

	try {
		// Log headers
		const authHeader = request.headers.get("authorization");
		console.log("🔑 Auth header exists:", !!authHeader);
		console.log(
			"🔑 Auth header (first 50):",
			authHeader?.substring(0, 50) + "..."
		);

		const user = await verifyToken(request);
		console.log(
			"👤 User verification result:",
			user ? `Yes (${user.userId})` : "No"
		);

		if (!user) {
			console.log("❌ No user found, returning 401");
			return NextResponse.json(
				{
					success: false,
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				},
				{ status: 401 }
			);
		}

		console.log("👤 User ID:", user.userId);
		console.log("👤 User email:", user.email);

		// Parse request body
		const body = await request.json();
		console.log("📦 Request body received:", {
			platform: body.platform,
			code: body.code ? `${body.code.substring(0, 30)}...` : "missing",
			state: body.state,
			hasCodeVerifier: !!body.codeVerifier,
		});

		const { platform, code, state, redirectUri, codeVerifier } = body;

		if (!platform || !code) {
			console.log("❌ Missing platform or code");
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

		console.log(`🔄 Processing ${platform} callback...`);

		// TEMPORARY: Use mock data to test saving
		console.log("⚠️ Using mock Twitter data for testing");

		const mockTokenData = {
			access_token: `mock_twitter_token_${Date.now()}`,
			refresh_token: `mock_refresh_${Date.now()}`,
			expires_in: 3600,
			token_type: "bearer",
			user: {
				id: `twitter_${Date.now()}`,
				username: "test_twitter_user",
				name: "Test Twitter User",
			},
		};

		console.log("📊 Connecting to database...");
		const { db } = await connectToDatabase();

		// Check database connection
		const dbStats = await db.stats();
		console.log("📊 Database connected:", dbStats.ok === 1);
		console.log("📊 Database name:", db.databaseName);

		const platformData = {
			userId: user.userId,
			name: platform.toLowerCase(),
			connected: true,
			username: mockTokenData.user.username,
			accessToken: mockTokenData.access_token,
			refreshToken: mockTokenData.refresh_token,
			tokenExpiry: new Date(Date.now() + mockTokenData.expires_in * 1000),
			platformUserId: mockTokenData.user.id,
			platformUserData: mockTokenData.user,
			limits: {
				postsPerHour: 5,
				postsPerDay: 20,
			},
			connectedAt: new Date(),
			lastSyncAt: new Date(),
			updatedAt: new Date(),
		};

		console.log("📦 Platform data to save:", {
			userId: platformData.userId,
			name: platformData.name,
			username: platformData.username,
			hasAccessToken: !!platformData.accessToken,
		});

		// Check if platform already connected
		console.log(
			`🔍 Checking for existing ${platform} for user ${user.userId}...`
		);
		const existingPlatform = await db.collection("platforms").findOne({
			userId: user.userId,
			name: platform.toLowerCase(),
		});

		console.log("🔍 Existing platform found:", !!existingPlatform);
		if (existingPlatform) {
			console.log("📦 Existing platform details:", {
				_id: existingPlatform._id?.toString(),
				userId: existingPlatform.userId,
				name: existingPlatform.name,
			});
		}

		let savedPlatform;
		if (existingPlatform) {
			// Update existing
			console.log("🔄 Updating existing platform...");
			const updateResult = await db
				.collection("platforms")
				.updateOne({ _id: existingPlatform._id }, { $set: platformData });
			console.log("✅ Update result:", {
				matchedCount: updateResult.matchedCount,
				modifiedCount: updateResult.modifiedCount,
			});
			savedPlatform = { ...platformData, _id: existingPlatform._id };
		} else {
			// Insert new
			console.log("🆕 Inserting new platform...");
			const insertResult = await db
				.collection("platforms")
				.insertOne(platformData);
			console.log("✅ Insert result:", {
				insertedId: insertResult.insertedId?.toString(),
				acknowledged: insertResult.acknowledged,
			});
			savedPlatform = { ...platformData, _id: insertResult.insertedId };
		}

		// Verify the save worked
		console.log("🔍 Verifying save...");
		const verifyPlatform = await db.collection("platforms").findOne({
			userId: user.userId,
			name: platform.toLowerCase(),
		});

		console.log(
			"✅ Verification result:",
			verifyPlatform ? "Found" : "Not found"
		);
		if (verifyPlatform) {
			console.log("📦 Verified platform:", {
				_id: verifyPlatform._id?.toString(),
				userId: verifyPlatform.userId,
				name: verifyPlatform.name,
				username: verifyPlatform.username,
			});
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
				debug: {
					userId: user.userId,
					saved: true,
					verified: !!verifyPlatform,
				},
			},
		});
	} catch (error: any) {
		console.error("💥 Callback error:", error);
		console.error("💥 Error stack:", error.stack);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message || "Internal server error",
				},
			},
			{ status: 500 }
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
