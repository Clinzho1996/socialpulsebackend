// app/api/auth/twitter/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const code = searchParams.get("code");
		const state = searchParams.get("state");

		console.log("📱 Twitter callback received:", { code, state });

		if (!code) {
			console.error("❌ No code in callback");
			return NextResponse.redirect(
				`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=No authorization code received`
			);
		}

		// Get code verifier from your storage (you need to store this when generating the auth URL)
		// For now, we'll handle it differently since you're not storing it
		const clientId = process.env.TWITTER_CLIENT_ID;
		const clientSecret = process.env.TWITTER_CLIENT_SECRET;
		const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`;

		console.log("🔑 Exchanging code for token...");

		// Exchange code for access token
		const tokenResponse = await fetch(
			"https://api.twitter.com/2/oauth2/token",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${Buffer.from(
						`${clientId}:${clientSecret}`
					).toString("base64")}`,
				},
				body: new URLSearchParams({
					code,
					grant_type: "authorization_code",
					redirect_uri: redirectUri,
					code_verifier: "challenge", // You need to store and retrieve the actual code_verifier
					client_id: clientId!,
				}),
			}
		);

		const tokenData = await tokenResponse.json();

		console.log("📊 Token response:", tokenData);

		if (!tokenResponse.ok) {
			console.error("❌ Token exchange failed:", tokenData);
			return NextResponse.redirect(
				`${
					process.env.NEXT_PUBLIC_APP_URL
				}/settings/integrations?error=${encodeURIComponent(
					tokenData.error_description || "Failed to get access token"
				)}`
			);
		}

		// Get user info from Twitter
		const userResponse = await fetch("https://api.twitter.com/2/users/me", {
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
			},
		});

		const userData = await userResponse.json();

		console.log("👤 Twitter user data:", userData);

		if (!userResponse.ok) {
			console.error("❌ Failed to get user info:", userData);
			return NextResponse.redirect(
				`${
					process.env.NEXT_PUBLIC_APP_URL
				}/settings/integrations?error=${encodeURIComponent(
					userData.detail || "Failed to get user info"
				)}`
			);
		}

		// Now you need to save this to your database
		// But we need to know which user this belongs to
		// You should store the state parameter with the user ID when generating the auth URL

		// For now, we'll redirect to a page where the frontend can save it
		const params = new URLSearchParams({
			platform: "twitter",
			access_token: tokenData.access_token,
			refresh_token: tokenData.refresh_token || "",
			token_expiry: new Date(
				Date.now() + tokenData.expires_in * 1000
			).toISOString(),
			twitter_user_id: userData.data.id,
			twitter_username: userData.data.username,
			twitter_name: userData.data.name,
		});

		return NextResponse.redirect(
			`${
				process.env.NEXT_PUBLIC_APP_URL
			}/settings/integrations/callback?${params.toString()}`
		);
	} catch (error: any) {
		console.error("❌ Twitter callback error:", error);
		return NextResponse.redirect(
			`${
				process.env.NEXT_PUBLIC_APP_URL
			}/settings/integrations?error=${encodeURIComponent(
				error.message || "Unknown error"
			)}`
		);
	}
}
