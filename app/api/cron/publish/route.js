// /app/api/cron/publish/route.js
import { connectToDatabase } from "@/lib/mongodb";
import { postToPlatforms } from "@/lib/social/platformApis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Ensure this runs dynamically
export const maxDuration = 60; // 60 seconds max for Vercel

export async function GET(request) {
	try {
		console.log("🕐 Cron job triggered at:", new Date().toISOString());

		// Optional: Add authentication for cron jobs
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		if (cronSecret && (!authHeader || authHeader !== `Bearer ${cronSecret}`)) {
			console.log("❌ Unauthorized cron request");
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const { db } = await connectToDatabase();
		const now = new Date();

		console.log("🔍 Checking for scheduled posts...");

		// Find posts that are scheduled and ready to publish
		const posts = await db
			.collection("posts")
			.find({
				status: "scheduled",
				scheduledTime: { $lte: now }, // Posts whose time has arrived
			})
			.toArray();

		console.log(`📤 Found ${posts.length} posts to process`);

		const results = [];

		for (const post of posts) {
			try {
				console.log(`Processing post: ${post._id} for user: ${post.userId}`);

				// Post to all specified platforms
				const postingResults = await postToPlatforms(
					post.userId,
					post.content,
					post.platforms || [],
					post.mediaUrls || []
				);

				// Track which platforms succeeded
				const successfulPlatforms = postingResults.filter((r) => r.success);
				const platformPostIds = {};

				successfulPlatforms.forEach((result) => {
					platformPostIds[result.platform] = result.postId;
				});

				// Determine post status
				let newStatus = "published";
				let finalMessage = "";

				if (successfulPlatforms.length === 0) {
					newStatus = "failed";
					finalMessage = "Failed on all platforms";
				} else if (successfulPlatforms.length < postingResults.length) {
					newStatus = "partial";
					finalMessage = `Published to ${successfulPlatforms.length}/${postingResults.length} platforms`;
				} else {
					finalMessage = "Published successfully";
				}

				// Update post in database
				await db.collection("posts").updateOne(
					{ _id: post._id },
					{
						$set: {
							status: newStatus,
							publishedAt: new Date(),
							platformPostIds: platformPostIds,
							publishingResults: postingResults,
							finalMessage: finalMessage,
							updatedAt: new Date(),
						},
						$push: {
							publishingHistory: {
								timestamp: new Date(),
								action: "auto_publish",
								results: postingResults,
								status: newStatus,
							},
						},
					}
				);

				results.push({
					postId: post._id.toString(),
					status: newStatus,
					platforms: post.platforms,
					successful: successfulPlatforms.length,
					total: postingResults.length,
					message: finalMessage,
				});

				console.log(`✅ Post ${post._id} processed: ${finalMessage}`);
			} catch (error) {
				console.error(`❌ Error processing post ${post._id}:`, error);

				// Mark as failed in database
				await db.collection("posts").updateOne(
					{ _id: post._id },
					{
						$set: {
							status: "failed",
							error: error.message,
							updatedAt: new Date(),
						},
					}
				);

				results.push({
					postId: post._id.toString(),
					status: "failed",
					error: error.message,
				});
			}
		}

		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			processed: posts.length,
			results: results,
			summary: {
				totalPosts: posts.length,
				successful: results.filter(
					(r) => r.status === "published" || r.status === "partial"
				).length,
				failed: results.filter((r) => r.status === "failed").length,
			},
		});
	} catch (error) {
		console.error("❌ Cron job error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error.message,
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}

// Also allow POST requests for manual triggering
export async function POST(request) {
	return GET(request);
}
