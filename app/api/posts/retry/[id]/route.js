import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { postToPlatforms } from "@/lib/social/platformApis";
import { ObjectId } from "mongodb";

export async function POST(request, { params }) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			return new Response(
				JSON.stringify({ success: false, error: "Authentication required" }),
				{ status: 401, headers: { "Content-Type": "application/json" } }
			);
		}

		const { id } = params;
		const { platforms = [] } = await request.json();

		const { db } = await connectToDatabase();

		const post = await db.collection("posts").findOne({
			_id: new ObjectId(id),
			userId: user.userId,
		});

		if (!post) {
			return new Response(
				JSON.stringify({ success: false, error: "Post not found" }),
				{ status: 404, headers: { "Content-Type": "application/json" } }
			);
		}

		// Determine which platforms to retry
		const platformsToRetry =
			platforms.length > 0
				? platforms
				: post.platforms.filter((p) => !post.platformPostIds?.[p]);

		if (platformsToRetry.length === 0) {
			return new Response(
				JSON.stringify({ success: false, error: "No platforms to retry" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		// Retry posting
		const results = await postToPlatforms(
			user.userId,
			post.content,
			platformsToRetry,
			post.mediaUrls || []
		);

		// Update platformPostIds with successful retries
		const platformPostIds = { ...(post.platformPostIds || {}) };
		const successful = results.filter((r) => r.success);

		successful.forEach((result) => {
			platformPostIds[result.platform] = result.postId;
		});

		// Determine new status
		const allPlatforms = [...new Set([...post.platforms, ...platformsToRetry])];
		const publishedPlatforms = Object.keys(platformPostIds);

		let newStatus = post.status;
		if (publishedPlatforms.length === allPlatforms.length) {
			newStatus = "published";
		} else if (publishedPlatforms.length > 0) {
			newStatus = "partial";
		}

		await db.collection("posts").updateOne(
			{ _id: post._id },
			{
				$set: {
					status: newStatus,
					platformPostIds: platformPostIds,
					updatedAt: new Date(),
				},
				$push: {
					publishingHistory: {
						timestamp: new Date(),
						results: results,
						status: newStatus,
						type: "retry",
					},
				},
			}
		);

		return new Response(
			JSON.stringify({
				success: true,
				data: {
					message: `Retried ${platformsToRetry.length} platforms`,
					results: results,
					newStatus: newStatus,
				},
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } }
		);
	} catch (error) {
		console.error("Retry error:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error.message || "Failed to retry posting",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}
