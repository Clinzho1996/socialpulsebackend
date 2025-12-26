import { connectToDatabase } from "@/lib/mongodb";
import { postToPlatforms } from "@/lib/social/platformApis";
import cron from "node-cron";

class PostScheduler {
	constructor() {
		this.isRunning = false;
	}

	start() {
		if (this.isRunning) {
			console.log("⚠️ Scheduler already running");
			return;
		}

		// Run every minute to check for posts
		cron.schedule("* * * * *", this.processScheduledPosts.bind(this));

		console.log("✅ Post scheduler started (running every minute)");
		this.isRunning = true;
	}

	async processScheduledPosts() {
		try {
			const { db } = await connectToDatabase();
			const now = new Date();

			// Find posts that are scheduled and ready to publish
			const posts = await db
				.collection("posts")
				.find({
					status: "scheduled",
					scheduledTime: { $lte: now }, // Past or equal to current time
				})
				.toArray();

			console.log(`🕐 Scheduler found ${posts.length} posts to process`);

			for (const post of posts) {
				try {
					console.log(`📤 Publishing post: ${post._id}`);

					// Post to all specified platforms
					const results = await postToPlatforms(
						post.userId,
						post.content,
						post.platforms,
						post.mediaUrls || []
					);

					// Track successes and failures
					const successfulPlatforms = [];
					const failedPlatforms = [];
					const platformPostIds = {};

					results.forEach((result) => {
						if (result.success) {
							successfulPlatforms.push(result.platform);
							platformPostIds[result.platform] = result.postId;
						} else {
							failedPlatforms.push(`${result.platform}: ${result.error}`);
						}
					});

					// Determine final status
					let finalStatus = "published";
					let finalMessage = "";

					if (successfulPlatforms.length === 0) {
						finalStatus = "failed";
						finalMessage = `Failed on all platforms: ${failedPlatforms.join(
							", "
						)}`;
					} else if (failedPlatforms.length > 0) {
						finalStatus = "partial";
						finalMessage = `Published to: ${successfulPlatforms.join(
							", "
						)}. Failed: ${failedPlatforms.join(", ")}`;
					} else {
						finalMessage = `Published to: ${successfulPlatforms.join(", ")}`;
					}

					// Update post in database
					await db.collection("posts").updateOne(
						{ _id: post._id },
						{
							$set: {
								status: finalStatus,
								publishedAt: new Date(),
								platformPostIds: platformPostIds,
								publishingResults: results,
								finalMessage: finalMessage,
								updatedAt: new Date(),
							},
							$push: {
								publishingHistory: {
									timestamp: new Date(),
									results: results,
									status: finalStatus,
								},
							},
						}
					);

					console.log(`✅ Post ${post._id} processed: ${finalMessage}`);
				} catch (error) {
					console.error(`❌ Error processing post ${post._id}:`, error);

					// Mark as failed
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
				}
			}
		} catch (error) {
			console.error("Scheduler error:", error);
		}
	}

	// Manual trigger for testing
	async processNow() {
		console.log("🔄 Manually triggering scheduler...");
		await this.processScheduledPosts();
	}
}

export const postScheduler = new PostScheduler();
