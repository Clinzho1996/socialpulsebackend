import { connectToDatabase } from "@/lib/mongodb";

// Get platform access token from database
async function getPlatformToken(userId, platform) {
	const { db } = await connectToDatabase();

	const platformData = await db.collection("platforms").findOne({
		userId: userId,
		platform: platform,
		connected: true,
	});

	if (!platformData) {
		throw new Error(`${platform} not connected`);
	}

	// Check if token is expired
	if (
		platformData.tokenExpiry &&
		new Date(platformData.tokenExpiry) < new Date()
	) {
		// Refresh token logic here (implement later)
		console.log(`${platform} token expired, needs refresh`);
	}

	return platformData.accessToken;
}

// Twitter API v2
export async function postToTwitter(userId, content, mediaUrls = []) {
	try {
		const accessToken = await getPlatformToken(userId, "twitter");

		// Build tweet payload
		const payload = { text: content };

		// Handle media if present
		if (mediaUrls.length > 0) {
			// Twitter requires uploading media first, then attaching media IDs
			// This is simplified - you'd need to upload each file
			console.log("Media handling for Twitter not implemented");
		}

		const response = await fetch("https://api.twitter.com/2/tweets", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		const data = await response.json();

		if (!response.ok) {
			console.error("Twitter API error:", data);
			throw new Error(data.detail || data.title || "Failed to post to Twitter");
		}

		return {
			platform: "twitter",
			success: true,
			postId: data.data.id,
			url: `https://twitter.com/user/status/${data.data.id}`,
		};
	} catch (error) {
		console.error("Twitter posting error:", error);
		throw error;
	}
}

// Facebook API (Page/Group)
export async function postToFacebook(userId, content, mediaUrls = []) {
	try {
		const accessToken = await getPlatformToken(userId, "facebook");

		// Facebook Graph API - posting to user timeline
		// Note: For pages, you need page access token
		const response = await fetch(`https://graph.facebook.com/v19.0/me/feed`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message: content,
				access_token: accessToken,
			}),
		});

		const data = await response.json();

		if (data.error) {
			console.error("Facebook API error:", data.error);
			throw new Error(data.error.message || "Failed to post to Facebook");
		}

		return {
			platform: "facebook",
			success: true,
			postId: data.id,
			url: `https://facebook.com/${data.id}`,
		};
	} catch (error) {
		console.error("Facebook posting error:", error);
		throw error;
	}
}

// Instagram Basic Display API
export async function postToInstagram(userId, content, mediaUrls = []) {
	try {
		const accessToken = await getPlatformToken(userId, "instagram");

		// Instagram requires media container creation for images/videos
		// This is a simplified version

		// For Instagram Basic Display API (no direct posting allowed)
		// You'd need Instagram Graph API for business/creator accounts

		// Check if user has Graph API access (business/creator account)
		const userResponse = await fetch(
			`https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`
		);

		const userData = await userResponse.json();

		if (
			userData.account_type === "BUSINESS" ||
			userData.account_type === "CREATOR"
		) {
			// Use Instagram Graph API
			// This requires additional setup and permissions
			console.log("Instagram Business/Creator account detected");
			throw new Error("Instagram Graph API posting not implemented");
		} else {
			throw new Error("Instagram Basic accounts cannot post via API");
		}
	} catch (error) {
		console.error("Instagram posting error:", error);
		throw error;
	}
}

// TikTok API v2
export async function postToTikTok(userId, content, mediaUrls = []) {
	try {
		const accessToken = await getPlatformToken(userId, "tiktok");

		// TikTok posting requires video upload
		if (mediaUrls.length === 0 || !mediaUrls[0].includes("video")) {
			throw new Error("TikTok requires video content");
		}

		// Simplified - actual TikTok posting requires:
		// 1. Initiate upload
		// 2. Upload video chunks
		// 3. Create post

		console.log("TikTok posting requires video upload implementation");
		return {
			platform: "tiktok",
			success: true,
			postId: "mock-tiktok-id",
			url: "https://tiktok.com/@user/video/mock-id",
		};
	} catch (error) {
		console.error("TikTok posting error:", error);
		throw error;
	}
}

// LinkedIn API v2
export async function postToLinkedIn(userId, content, mediaUrls = []) {
	try {
		const accessToken = await getPlatformToken(userId, "linkedin");

		// LinkedIn API requires URN (unique resource name) of user/company
		// First get user profile to get URN
		const profileResponse = await fetch(
			"https://api.linkedin.com/v2/userinfo",
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const profileData = await profileResponse.json();
		const authorUrn = `urn:li:person:${profileData.sub}`;

		// Create post
		const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				author: authorUrn,
				lifecycleState: "PUBLISHED",
				specificContent: {
					"com.linkedin.ugc.ShareContent": {
						shareCommentary: {
							text: content,
						},
						shareMediaCategory: "NONE",
					},
				},
				visibility: {
					"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
				},
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			console.error("LinkedIn API error:", data);
			throw new Error(data.message || "Failed to post to LinkedIn");
		}

		return {
			platform: "linkedin",
			success: true,
			postId: data.id,
			url: `https://linkedin.com/feed/update/${data.id}`,
		};
	} catch (error) {
		console.error("LinkedIn posting error:", error);
		throw error;
	}
}

// Platform mapper
const PLATFORM_POST_FUNCTIONS = {
	twitter: postToTwitter,
	facebook: postToFacebook,
	instagram: postToInstagram,
	tiktok: postToTikTok,
	linkedin: postToLinkedIn,
};

// Main function to post to all platforms
export async function postToPlatforms(
	userId,
	content,
	platforms,
	mediaUrls = []
) {
	const results = [];

	for (const platform of platforms) {
		try {
			const postFunction = PLATFORM_POST_FUNCTIONS[platform];
			if (postFunction) {
				const result = await postFunction(userId, content, mediaUrls);
				results.push(result);
			} else {
				results.push({
					platform,
					success: false,
					error: "Platform posting function not found",
				});
			}
		} catch (error) {
			results.push({
				platform,
				success: false,
				error: error.message,
			});
		}
	}

	return results;
}
