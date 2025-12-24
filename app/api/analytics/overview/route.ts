// app/api/analytics/overview/route.ts
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

// Add CORS headers helper
function setCorsHeaders(
	response: NextResponse,
	request: NextRequest
): NextResponse {
	const allowedOrigins = [
		"http://localhost:5173",
		"http://localhost:3000",
		"https://socialpulseai.vercel.app",
	];

	const origin = request.headers.get("origin");
	const isAllowedOrigin = allowedOrigins.includes(origin || "");

	const headers = {
		"Access-Control-Allow-Origin": isAllowedOrigin
			? origin!
			: allowedOrigins[0],
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Allow-Credentials": "true",
	};

	Object.entries(headers).forEach(([key, value]) => {
		response.headers.set(key, value);
	});

	return response;
}

export async function OPTIONS(request: NextRequest) {
	const allowedOrigins = [
		"http://localhost:5173",
		"http://localhost:3000",
		"https://socialplusbbackend.vercel.app",
	];

	const origin = request.headers.get("origin");
	const isAllowedOrigin = allowedOrigins.includes(origin || "");

	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": isAllowedOrigin
				? origin!
				: allowedOrigins[0],
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Access-Control-Allow-Credentials": "true",
		},
	});
}

export async function GET(request: NextRequest) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			const response = NextResponse.json(
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
			return setCorsHeaders(response, request);
		}

		const { searchParams } = new URL(request.url);
		const range = searchParams.get("range") || "week";
		const { db } = await connectToDatabase();

		// ✅ Firebase UID is a string, not ObjectId
		if (!user.userId || typeof user.userId !== "string") {
			const response = NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid user ID",
					},
				},
				{ status: 400 }
			);
			return setCorsHeaders(response, request);
		}

		// Calculate date range
		const now = new Date();
		let startDate = new Date();

		switch (range) {
			case "week":
				startDate.setDate(now.getDate() - 7);
				break;
			case "month":
				startDate.setMonth(now.getMonth() - 1);
				break;
			case "year":
				startDate.setFullYear(now.getFullYear() - 1);
				break;
		}

		// Get post counts
		const totalPosts = await db.collection("posts").countDocuments({
			userId: user.userId,
		});

		const scheduled = await db.collection("posts").countDocuments({
			userId: user.userId,
			status: "scheduled",
		});

		const published = await db.collection("posts").countDocuments({
			userId: user.userId,
			status: "published",
		});

		const failed = await db.collection("posts").countDocuments({
			userId: user.userId,
			status: "failed",
		});

		// Calculate engagement from published posts
		const publishedPosts = await db
			.collection("posts")
			.find({
				userId: user.userId,
				status: "published",
				createdAt: { $gte: startDate },
			})
			.toArray();

		let totalEngagement = 0;
		let totalLikes = 0;
		let totalComments = 0;
		let totalShares = 0;

		publishedPosts.forEach((post: any) => {
			const analytics = post.analytics || { likes: 0, comments: 0, shares: 0 };
			totalLikes += analytics.likes || 0;
			totalComments += analytics.comments || 0;
			totalShares += analytics.shares || 0;
		});

		totalEngagement = totalLikes + totalComments + totalShares;

		// Calculate trends (simplified - compare with previous period)
		const previousStartDate = new Date(startDate);
		previousStartDate.setDate(
			previousStartDate.getDate() -
				(range === "week" ? 7 : range === "month" ? 30 : 365)
		);

		const previousPublished = await db.collection("posts").countDocuments({
			userId: user.userId,
			status: "published",
			createdAt: {
				$gte: previousStartDate,
				$lt: startDate,
			},
		});

		const postsTrend =
			previousPublished > 0
				? Math.round(
						((published - previousPublished) / previousPublished) * 100
				  )
				: published > 0
				? 100
				: 0;

		const response = NextResponse.json({
			success: true,
			data: {
				totalPosts,
				scheduled,
				published,
				failed,
				engagement: {
					total: totalEngagement,
					likes: totalLikes,
					comments: totalComments,
					shares: totalShares,
				},
				trends: {
					posts: postsTrend,
					engagement: 0, // You can add engagement trend calculation here
				},
			},
		});

		return setCorsHeaders(response, request);
	} catch (error: any) {
		console.error("Analytics overview error:", error);
		const response = NextResponse.json(
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
		return setCorsHeaders(response, request);
	}
}
