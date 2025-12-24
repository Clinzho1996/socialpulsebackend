import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

/* ================================
   Twitter Token Exchange
================================ */

async function exchangeTwitterCode(
	code: string,
	redirectUri: string,
	codeVerifier: string
) {
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
		code_verifier: codeVerifier, // ✅ FIXED PKCE
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

	let data;
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

	console.log("✅ Twitter token exchange successful");

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token || null,
		expiresIn: data.expires_in,
		tokenType: data.token_type,
		user: {
			id: data.user_id,
			username: data.username || data.screen_name || null,
		},
	};
}

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

		if (platform === "twitter" && !codeVerifier) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "PKCE_REQUIRED",
						message: "Missing PKCE code verifier",
					},
				},
				{ status: 400 }
			);
		}

		console.log(`📱 Processing ${platform} for user ${user.userId}`);

		/* -------- Exchange Token -------- */
		let tokenData;

		if (platform === "twitter") {
			tokenData = await exchangeTwitterCode(code, redirectUri, codeVerifier);
		} else {
			throw new Error(`Unsupported platform: ${platform}`);
		}

		/* -------- Database -------- */
		const { db } = await connectToDatabase();

		const now = new Date();

		const platformRecord = {
			userId: user.userId, // Firebase UID
			platform: platform.toLowerCase(),
			name: platform.toLowerCase(),
			connected: true,
			username: tokenData.user?.username || null,
			accessToken: tokenData.accessToken,
			refreshToken: tokenData.refreshToken,
			tokenExpiry: tokenData.expiresIn
				? new Date(Date.now() + tokenData.expiresIn * 1000)
				: null,
			platformUserId: tokenData.user?.id || null,
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
		return NextResponse.json({
			success: true,
			data: {
				platform: {
					_id: savedId.toString(),
					platform: platform.toLowerCase(),
					username: platformRecord.username,
					connected: true,
					connectedAt: platformRecord.connectedAt,
				},
				message: `Successfully connected to ${platform}`,
			},
		});
	} catch (error: any) {
		console.error("❌ OAuth callback error:", error);

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
