import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

// Allowed origins for CORS
const allowedOrigins = [
	"http://localhost:5173", // Vite dev server
	"http://localhost:3000", // Next.js dev server
	"https://socialplusbbackend.vercel.app", // Your production backend
	"https://socialpulseai.vercel.app", // Your production frontend
	// Add other origins as needed
];

// Helper function to set CORS headers
function setCorsHeaders(
	response: NextResponse,
	request: NextRequest
): NextResponse {
	const origin = request.headers.get("origin");
	const isAllowedOrigin = allowedOrigins.includes(origin || "");

	const headers = {
		"Access-Control-Allow-Origin": isAllowedOrigin
			? origin!
			: allowedOrigins[0],
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Authorization, X-Requested-With",
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Max-Age": "86400", // 24 hours
	};

	Object.entries(headers).forEach(([key, value]) => {
		response.headers.set(key, value);
	});

	return response;
}

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
	const origin = request.headers.get("origin");
	const isAllowedOrigin = allowedOrigins.includes(origin || "");

	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": isAllowedOrigin
				? origin!
				: allowedOrigins[0],
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
			"Access-Control-Allow-Headers":
				"Content-Type, Authorization, X-Requested-With",
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Max-Age": "86400",
			Vary: "Origin", // Important for caching
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
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				},
				{ status: 401 }
			);
			return setCorsHeaders(response, request);
		}

		// ✅ Firebase UID is a string, not ObjectId
		if (!user.userId || typeof user.userId !== "string") {
			console.error("Invalid userId:", user.userId);
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

		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "10");
		const status = searchParams.get("status");
		const platform = searchParams.get("platform");
		const search = searchParams.get("search");

		const { db } = await connectToDatabase();

		// ✅ Query using Firebase UID as string
		const query: any = {
			userId: user.userId, // String, not ObjectId
		};

		if (status && status !== "all") query.status = status;
		if (platform && platform !== "all") {
			query.platforms = platform;
		}
		if (search) query.content = { $regex: search, $options: "i" };

		// Get total count
		const total = await db.collection("posts").countDocuments(query);

		// Get posts with pagination
		const posts = await db
			.collection("posts")
			.find(query)
			.sort({ scheduledTime: -1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.toArray();

		const response = NextResponse.json({
			success: true,
			data: {
				posts: posts.map((post) => ({
					id: post._id.toString(),
					content: post.content,
					platforms: post.platforms,
					status: post.status,
					scheduledTime: post.scheduledTime.toISOString(),
					engagement: post.analytics || {
						likes: 0,
						comments: 0,
						shares: 0,
						views: 0,
					},
					mediaUrls: post.mediaUrls || [],
					category: post.category || "feed",
					createdAt: post.createdAt?.toISOString(),
					updatedAt: post.updatedAt?.toISOString(),
				})),
				pagination: {
					page,
					limit,
					total,
					pages: Math.ceil(total / limit),
				},
			},
		});

		return setCorsHeaders(response, request);
	} catch (error: any) {
		console.error("Get posts error:", error);
		const response = NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message || "Internal server error",
				},
			},
			{ status: 500 }
		);
		return setCorsHeaders(response, request);
	}
}

export async function POST(request: NextRequest) {
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

		// ✅ FIX: Validate userId before converting to ObjectId
		if (!user.userId || !ObjectId.isValid(user.userId)) {
			console.error("Invalid userId:", user.userId);
			const response = NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid user ID format",
					},
				},
				{
					status: 400,
				}
			);
			return setCorsHeaders(response, request);
		}

		const body = await request.json();
		const { content, platforms, category, scheduledTime, mediaUrls, status } =
			body;

		// Validation
		if (!content || !platforms || !scheduledTime) {
			const response = NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Content, platforms, and scheduled time are required",
					},
				},
				{
					status: 400,
				}
			);
			return setCorsHeaders(response, request);
		}

		// Validate platforms array
		if (!Array.isArray(platforms) || platforms.length === 0) {
			const response = NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Platforms must be a non-empty array",
					},
				},
				{
					status: 400,
				}
			);
			return setCorsHeaders(response, request);
		}

		const { db } = await connectToDatabase();

		// Create post with validated ObjectId
		const newPost = {
			userId: new ObjectId(user.userId),
			content,
			platforms,
			category: category || "feed",
			scheduledTime: new Date(scheduledTime),
			status: status || "scheduled",
			mediaUrls: mediaUrls || [],
			platformPostIds: [],
			analytics: {
				likes: 0,
				comments: 0,
				shares: 0,
				views: 0,
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const result = await db.collection("posts").insertOne(newPost);

		const response = NextResponse.json(
			{
				success: true,
				data: {
					id: result.insertedId.toString(),
					content: newPost.content,
					platforms: newPost.platforms,
					status: newPost.status,
					scheduledTime: newPost.scheduledTime.toISOString(),
					category: newPost.category,
					mediaUrls: newPost.mediaUrls,
					engagement: newPost.analytics,
					createdAt: newPost.createdAt.toISOString(),
					updatedAt: newPost.updatedAt.toISOString(),
				},
			},
			{
				status: 201,
			}
		);

		return setCorsHeaders(response, request);
	} catch (error: any) {
		console.error("Create post error:", error);
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

// Optional: Add DELETE and PUT methods with CORS
export async function DELETE(request: NextRequest) {
	const response = NextResponse.json(
		{
			success: false,
			error: {
				code: "METHOD_NOT_ALLOWED",
				message: "DELETE method not implemented",
			},
		},
		{ status: 405 }
	);
	return setCorsHeaders(response, request);
}

export async function PUT(request: NextRequest) {
	const response = NextResponse.json(
		{
			success: false,
			error: {
				code: "METHOD_NOT_ALLOWED",
				message: "PUT method not implemented",
			},
		},
		{ status: 405 }
	);
	return setCorsHeaders(response, request);
}
