import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { postToPlatforms } from "@/lib/social/platformApis";
import { ObjectId } from "mongodb";

export async function POST(request) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			return new Response(
				JSON.stringify({ success: false, error: "Authentication required" }),
				{ status: 401, headers: { "Content-Type": "application/json" } }
			);
		}

		const { postId, immediate = false } = await request.json();

		if (!postId) {
			return new Response(
				JSON.stringify({ success: false, error: "Post ID is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		const { db } = await connectToDatabase();

		// Get the post
		const post = await db.collection("posts").findOne({
			_id: new ObjectId(postId),
			userId: user.userId,
		});

		if (!post) {
			return new Response(
				JSON.stringify({ success: false, error: "Post not found" }),
				{ status: 404, headers: { "Content-Type": "application/json" } }
			);
		}

		// Check if post is scheduled (not already published)
		if (post.status === "published" && !immediate) {
			return new Response(
				JSON.stringify({ success: false, error: "Post already published" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
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
			return new Response(
				JSON.stringify({
					success: false,
					error: `Some platforms not connected: ${missingPlatforms.join(", ")}`,
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		// Post to platforms
		const platformsToPost = immediate ? connectedPlatformNames : post.platforms;
		const results = await postToPlatforms(
			user.userId,
			post.content,
			platformsToPost,
			post.mediaUrls || []
		);

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

		if (immediate) {
			updateData.publishedAt = new Date();
			updateData.platformPostIds = platformPostIds;
		}

		await db
			.collection("posts")
			.updateOne({ _id: post._id }, { $set: updateData });

		return new Response(
			JSON.stringify({
				success: true,
				data: {
					message,
					status: newStatus,
					results: results,
					platformPostIds: platformPostIds,
				},
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } }
		);
	} catch (error) {
		console.error("Publish error:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error.message || "Failed to publish post",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}
