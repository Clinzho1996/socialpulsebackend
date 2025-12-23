// app/api/platforms/route.ts - FIXED
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

		// ✅ Query with Firebase UID as string
		const platforms = await db
			.collection("platforms")
			.find({ userId: user.userId }) // String, not ObjectId
			.toArray();

		console.log(`Found ${platforms.length} platforms for user ${user.userId}`);

		// Format response
		const formattedPlatforms = platforms.map((platform) => ({
			id: platform._id?.toString(),
			_id: platform._id?.toString(),
			name: platform.name?.toLowerCase(),
			platform: platform.name?.toLowerCase(),
			userId: platform.userId,
			accessToken: platform.accessToken,
			refreshToken: platform.refreshToken,
			tokenExpiry: platform.tokenExpiry,
			// Determine connection status
			connected: !!(
				platform.accessToken &&
				(!platform.tokenExpiry || new Date(platform.tokenExpiry) > new Date())
			),
			isConnected: !!(
				platform.accessToken &&
				(!platform.tokenExpiry || new Date(platform.tokenExpiry) > new Date())
			),
			username: platform.username || platform.email || platform.name || "User",
			followers: platform.followers?.toString() || "0",
			createdAt: platform.createdAt,
			updatedAt: platform.updatedAt,
		}));

		return NextResponse.json({
			success: true,
			data: formattedPlatforms,
		});
	} catch (error: any) {
		console.error("Get platforms error:", error);
		return NextResponse.json(
			{
				success: false,
				error: { code: "SERVER_ERROR", message: error.message },
			},
			{ status: 500 }
		);
	}
}
