// /api/platforms/save/route.ts (Next.js backend)
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Authentication required" },
				{ status: 401 }
			);
		}

		const { platform, code, redirectUri } = await request.json();

		if (!platform || !code) {
			return NextResponse.json(
				{ success: false, error: "Platform and code are required" },
				{ status: 400 }
			);
		}

		// Exchange code for access token
		const tokenData = await exchangeCodeForToken(platform, code, redirectUri);

		// Get user info from platform
		const userInfo = await getUserInfo(platform, tokenData.access_token);

		// Save to database
		const savedPlatform = await savePlatformToDB(
			user.userId,
			platform,
			tokenData,
			userInfo
		);

		return NextResponse.json({
			success: true,
			data: savedPlatform,
		});
	} catch (error: any) {
		console.error("Save platform error:", error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}

async function exchangeCodeForToken(
	platform: string,
	code: string,
	redirectUri: string
) {
	let tokenUrl = "";
	let body: any = {};
	let headers: any = {};

	switch (platform) {
		case "twitter":
			tokenUrl = "https://api.twitter.com/2/oauth2/token";
			body = new URLSearchParams({
				code,
				grant_type: "authorization_code",
				redirect_uri: redirectUri,
				client_id: process.env.TWITTER_CLIENT_ID!,
				code_verifier: "challenge", // You should store and retrieve this properly
			});
			headers = {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(
					`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
				).toString("base64")}`,
			};
			break;

		case "facebook":
			tokenUrl = "https://graph.facebook.com/v18.0/oauth/access_token";
			body = new URLSearchParams({
				client_id: process.env.FACEBOOK_CLIENT_ID!,
				client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
				redirect_uri: redirectUri,
				code,
			});
			headers = { "Content-Type": "application/x-www-form-urlencoded" };
			break;

		// Add other platforms...
	}

	const response = await fetch(tokenUrl, {
		method: "POST",
		headers,
		body,
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(
			data.error_description || data.error?.message || "Failed to exchange code"
		);
	}

	return data;
}

async function getUserInfo(platform: string, accessToken: string) {
	let url = "";

	switch (platform) {
		case "twitter":
			url =
				"https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url";
			break;

		case "facebook":
			url = `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${accessToken}`;
			break;

		// Add other platforms...
	}

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(
			data.detail || data.error?.message || "Failed to get user info"
		);
	}

	return data;
}

async function savePlatformToDB(
	userId: string,
	platform: string,
	tokenData: any,
	userInfo: any
) {
	const { db } = await connectToDatabase();

	const platformData = {
		userId,
		name: platform.toLowerCase(),
		accessToken: tokenData.access_token,
		refreshToken: tokenData.refresh_token || null,
		tokenExpiry: tokenData.expires_in
			? new Date(Date.now() + tokenData.expires_in * 1000)
			: null,
		username: getUsername(platform, userInfo),
		platformUserId: getUserid(platform, userInfo),
		followers: "0",
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	// Check if platform already exists
	const existing = await db.collection("platforms").findOne({
		userId,
		name: platform.toLowerCase(),
	});

	let result;
	if (existing) {
		// Update existing
		result = await db
			.collection("platforms")
			.updateOne({ _id: existing._id }, { $set: platformData });
		return { ...platformData, id: existing._id.toString() };
	} else {
		// Insert new
		result = await db.collection("platforms").insertOne(platformData);
		return { ...platformData, id: result.insertedId.toString() };
	}
}

function getUsername(platform: string, userInfo: any) {
	switch (platform) {
		case "twitter":
			return userInfo.data?.username || userInfo.data?.name;
		case "facebook":
			return userInfo.name;
		default:
			return "User";
	}
}

function getUserid(platform: string, userInfo: any) {
	switch (platform) {
		case "twitter":
			return userInfo.data?.id;
		case "facebook":
			return userInfo.id;
		default:
			return "";
	}
}
