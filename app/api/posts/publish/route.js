import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { postToPlatforms } from "@/lib/social/platformApis";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export async function POST(request) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Authentication required" },
				{ status: 401 }
			);
		}

		const { postId, immediate = true } = await request.json();

		if (!postId) {
			return NextResponse.json(
				{ success: false, error: "Post ID is required" },
				{ status: 400 }
			);
		}

		const { db } = await connectToDatabase();

		// Get the post
		const post = await db.collection("posts").findOne({
			_id: new ObjectId(postId),
			userId: user.userId,
		});

		if (!post) {
			return NextResponse.json(
				{ success: false, error: "Post not found" },
				{ status: 404 }
			);
		}

		// Allow re-publishing if already published
		if (post.status === "published" && !immediate) {
			return NextResponse.json(
				{ success: false, error: "Post already published" },
				{ status: 400 }
			);
		}

		// Check connected platforms
		const connectedPlatforms = await db
			.collection("platforms")
			.find({
				userId: user.userId,
				platform: { $in: post.platforms },
				connected: true,
			})
			.toArray();

		const connectedPlatformNames = connectedPlatforms.map((p) => p.platform);
		const missingPlatforms = post.platforms.filter(
			(p) => !connectedPlatformNames.includes(p)
		);

		if (missingPlatforms.length > 0 && !immediate) {
			return NextResponse.json(
				{
					success: false,
					error: `Some platforms not connected: ${missingPlatforms.join(", ")}`,
				},
				{ status: 400 }
			);
		}

		// Post to platforms
		const platformsToPost = immediate ? connectedPlatformNames : post.platforms;
		console.log(`🚀 Publishing post ${postId} to platforms:`, platformsToPost);

		const results = await postToPlatforms(
			user.userId,
			post.content,
			platformsToPost,
			post.mediaUrls || []
		);

		console.log(`📊 Publishing results:`, results);

		// Determine status
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		let newStatus = "published";
		let message = "";

		if (successful.length === 0) {
			newStatus = "failed";
			message = "Failed on all platforms";
		} else if (failed.length > 0) {
			newStatus = "partial";
			message = `Published to ${successful.length}/${results.length} platforms`;
		} else {
			message = "Published successfully";
		}

		// Collect platform post IDs
		const platformPostIds = {};
		successful.forEach((result) => {
			platformPostIds[result.platform] = result.postId;
		});

		// Create publishing history entry
		const publishingHistoryEntry = {
			timestamp: new Date(),
			results: results,
			status: newStatus,
			triggeredBy: "manual",
		};

		// Update post - CORRECTED: Use separate update operators
		const updateResult = await db.collection("posts").updateOne(
			{ _id: post._id },
			{
				$set: {
					status: newStatus,
					updatedAt: new Date(),
					publishingResults: results,
					finalMessage: message,
					publishedAt: new Date(),
					platformPostIds: platformPostIds,
				},
				$push: {
					publishingHistory: publishingHistoryEntry,
				},
			}
		);

		if (updateResult.modifiedCount === 0) {
			console.error("Failed to update post");
			return NextResponse.json(
				{
					success: false,
					error: "Failed to update post in database",
				},
				{ status: 500 }
			);
		}

		// Get the updated post
		const updatedPost = await db.collection("posts").findOne({ _id: post._id });

		return NextResponse.json({
			success: true,
			data: {
				message,
				status: newStatus,
				results: results,
				platformPostIds: platformPostIds,
				postId: post._id.toString(),
				post: {
					id: updatedPost._id.toString(),
					content: updatedPost.content,
					platforms: updatedPost.platforms,
					status: updatedPost.status,
					scheduledTime: updatedPost.scheduledTime?.toISOString(),
					publishedAt: updatedPost.publishedAt?.toISOString(),
					finalMessage: updatedPost.finalMessage,
					platformPostIds: updatedPost.platformPostIds,
				},
			},
		});
	} catch (error) {
		console.error("Publish error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error.message || "Failed to publish post to platforms",
			},
			{ status: 500 }
		);
	}
}
