import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

		const { db } = await connectToDatabase();

		// Get platforms for this user
		const platforms = await db
			.collection("platforms")
			.find({ userId: user.userId })
			.toArray();

		console.log(
			`Found ${platforms.length} platforms for user ${user.userId}:`,
			platforms.map((p) => ({ name: p.name, hasAccessToken: !!p.accessToken }))
		);

		// Format platforms for frontend
		const formattedPlatforms = platforms.map((platform) => {
			const basePlatform = {
				id: platform._id?.toString() || platform.id,
				_id: platform._id?.toString() || platform.id,
				name: platform.name?.toLowerCase() || platform.platform,
				platform: platform.name?.toLowerCase() || platform.platform,
				userId: platform.userId,
				accessToken: platform.accessToken,
				refreshToken: platform.refreshToken,
				tokenExpiry: platform.tokenExpiry,
				createdAt: platform.createdAt,
				updatedAt: platform.updatedAt,
				// Determine if connected based on access token
				connected: !!(
					platform.accessToken &&
					(!platform.tokenExpiry || new Date(platform.tokenExpiry) > new Date())
				),
				isConnected: !!(
					platform.accessToken &&
					(!platform.tokenExpiry || new Date(platform.tokenExpiry) > new Date())
				),
			};

			// Add platform-specific fields
			if (
				platform.name?.toLowerCase() === "facebook" ||
				platform.platform === "facebook"
			) {
				return {
					...basePlatform,
					username:
						platform.email ||
						platform.username ||
						platform.name ||
						"Facebook User",
					followers: platform.followers?.toString() || "0",
				};
			}

			if (
				platform.name?.toLowerCase() === "twitter" ||
				platform.platform === "twitter"
			) {
				return {
					...basePlatform,
					username: platform.username || platform.screenName || "Twitter User",
					followers: platform.followers?.toString() || "0",
				};
			}

			if (
				platform.name?.toLowerCase() === "instagram" ||
				platform.platform === "instagram"
			) {
				return {
					...basePlatform,
					username: platform.username || "Instagram User",
					followers: platform.followers?.toString() || "0",
				};
			}

			// Default for other platforms
			return {
				...basePlatform,
				username:
					platform.username || platform.email || platform.name || "User",
				followers: platform.followers?.toString() || "0",
			};
		});

		return NextResponse.json({
			success: true,
			data: formattedPlatforms,
		});
	} catch (error: any) {
		console.error("Get platforms error:", error);
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
