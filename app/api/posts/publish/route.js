// /app/api/posts/publish/route.js
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
				{ success: false, error: "Authentication required by user" },
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

		// Update post
		const updateData = {
			status: newStatus,
			updatedAt: new Date(),
			publishingResults: results,
			finalMessage: message,
			$push: {
				publishingHistory: {
					timestamp: new Date(),
					results: results,
					status: newStatus,
					triggeredBy: "manual",
				},
			},
		};

		// Always update publishedAt for manual publishing
		updateData.publishedAt = new Date();
		updateData.platformPostIds = platformPostIds;

		await db
			.collection("posts")
			.updateOne({ _id: post._id }, { $set: updateData });

		return NextResponse.json({
			success: true,
			data: {
				message,
				status: newStatus,
				results: results,
				platformPostIds: platformPostIds,
				postId: post._id.toString(),
			},
		});
	} catch (error) {
		console.error("Publish error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error.message || "Failed to publish post",
			},
			{ status: 500 }
		);
	}
}
