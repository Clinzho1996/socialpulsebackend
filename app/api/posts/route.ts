import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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
				{
					status: 401,
				}
			);
		}

		// ✅ FIX: Validate userId before converting to ObjectId
		if (!user.userId || !ObjectId.isValid(user.userId)) {
			console.error("Invalid userId:", user.userId);
			return NextResponse.json(
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
		}

		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "10");
		const status = searchParams.get("status");
		const platform = searchParams.get("platform");
		const search = searchParams.get("search");

		const { db } = await connectToDatabase();

		// Build query with validated ObjectId
		const query: any = {
			userId: new ObjectId(user.userId),
		};

		if (status) query.status = status;
		if (platform) query.platforms = platform;
		if (search)
			query.content = {
				$regex: search,
				$options: "i",
			};

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

		return NextResponse.json({
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
	} catch (error: any) {
		console.error("Get posts error:", error);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message,
				},
			},
			{
				status: 500,
			}
		);
	}
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
				{
					status: 401,
				}
			);
		}

		// ✅ FIX: Validate userId before converting to ObjectId
		if (!user.userId || !ObjectId.isValid(user.userId)) {
			console.error("Invalid userId:", user.userId);
			return NextResponse.json(
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
		}

		const body = await request.json();
		const { content, platforms, category, scheduledTime, mediaUrls, status } =
			body;

		// Validation
		if (!content || !platforms || !scheduledTime) {
			return NextResponse.json(
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
		}

		// Validate platforms array
		if (!Array.isArray(platforms) || platforms.length === 0) {
			return NextResponse.json(
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

		return NextResponse.json(
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
				},
			},
			{
				status: 201,
			}
		);
	} catch (error: any) {
		console.error("Create post error:", error);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message,
				},
			},
			{
				status: 500,
			}
		);
	}
}
