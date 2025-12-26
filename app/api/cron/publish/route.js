// /app/api/cron/publish/route.js - Production-ready version
import { connectToDatabase } from "@/lib/mongodb";
import { postToPlatforms } from "@/lib/social/platformApis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
	try {
		console.log("🕐 Cron job triggered at:", new Date().toISOString());

		// Authentication for cron jobs
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET?.trim();

		console.log("🔐 CRON_SECRET exists:", !!cronSecret);
		console.log("📨 Auth header exists:", !!authHeader);

		if (cronSecret && (!authHeader || authHeader !== `Bearer ${cronSecret}`)) {
			console.log("❌ Unauthorized cron request");
			console.log(
				"Expected header starts with:",
				`Bearer ${cronSecret.substring(0, 10)}...`
			);
			console.log("Received header starts with:", authHeader?.substring(0, 50));
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 }
			);
		}

		console.log("✅ Authentication passed!");

		const { db } = await connectToDatabase();
		const now = new Date();

		console.log("🔍 Checking for scheduled posts...");

		// Find posts that are scheduled and ready to publish
		const posts = await db
			.collection("posts")
			.find({
				status: "scheduled",
				scheduledTime: { $lte: now },
			})
			.toArray();

		console.log(`📤 Found ${posts.length} posts to process`);

		if (posts.length === 0) {
			return NextResponse.json({
				success: true,
				message: "No posts to publish at this time",
				timestamp: new Date().toISOString(),
				processed: 0,
				results: [],
			});
		}

		const results = [];

		for (const post of posts) {
			try {
				console.log(
					`\n📝 Processing post ${post._id} for user: ${post.userId}`
				);
				console.log(`📄 Content: ${post.content.substring(0, 50)}...`);
				console.log(`🌐 Platforms: ${post.platforms.join(", ")}`);

				// Check if user has connected platforms
				const userPlatforms = await db
					.collection("platforms")
					.find({
						userId: post.userId,
						platform: { $in: post.platforms },
						connected: true,
					})
					.toArray();

				console.log(`🔗 Found ${userPlatforms.length} connected platforms:`);
				userPlatforms.forEach((p) => console.log(`   - ${p.platform}`));

				if (userPlatforms.length === 0) {
					console.log(
						`❌ No connected platforms found for user ${post.userId}`
					);

					await db.collection("posts").updateOne(
						{ _id: post._id },
						{
							$set: {
								status: "failed",
								finalMessage: "No platforms connected",
								updatedAt: new Date(),
							},
						}
					);

					results.push({
						postId: post._id.toString(),
						status: "failed",
						error: "No platforms connected",
					});
					continue;
				}

				// Post to platforms
				console.log(`🚀 Attempting to post to platforms...`);
				const postingResults = await postToPlatforms(
					post.userId,
					post.content,
					userPlatforms.map((p) => p.platform),
					post.mediaUrls || []
				);

				console.log(`📊 Posting results:`);
				postingResults.forEach((result) => {
					console.log(
						`   - ${result.platform}: ${result.success ? "✅" : "❌"} ${
							result.message || ""
						}`
					);
				});

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
					platformResults: postingResults,
				});

				console.log(`✅ Post ${post._id} processed: ${finalMessage}`);
			} catch (error) {
				console.error(`❌ Error processing post ${post._id}:`, error);
				console.error(error.stack);

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
		console.error(error.stack);
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

export async function POST(request) {
	return GET(request);
}
