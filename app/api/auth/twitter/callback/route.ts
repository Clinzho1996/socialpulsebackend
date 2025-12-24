// app/api/auth/twitter/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const code = searchParams.get("code");
		const state = searchParams.get("state");
		const error = searchParams.get("error");
		const errorDescription = searchParams.get("error_description");

		// Handle errors
		if (error) {
			console.error("Twitter OAuth error:", {
				error,
				errorDescription,
				state,
			});

			// Redirect back to your app with error
			return NextResponse.redirect(
				new URL(
					`/settings/integrations?error=${encodeURIComponent(
						errorDescription || error
					)}`,
					request.url
				)
			);
		}

		if (!code) {
			return NextResponse.redirect(
				new URL(
					"/settings/integrations?error=No authorization code received",
					request.url
				)
			);
		}

		// Exchange code for access token
		const clientId = process.env.TWITTER_CLIENT_ID;
		const clientSecret = process.env.TWITTER_CLIENT_SECRET;
		const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`;

		// IMPORTANT: You need to get the code_verifier that was stored
		// when generating the auth URL. This should be stored server-side
		// or passed via state parameter.
		const codeVerifier = ""; // Get from your storage based on state

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
					client_id: clientId!,
					redirect_uri: redirectUri,
					code_verifier: codeVerifier,
				}),
			}
		);

		const tokenData = await tokenResponse.json();

		if (!tokenResponse.ok) {
			console.error("Token exchange error:", tokenData);
			return NextResponse.redirect(
				new URL(
					`/settings/integrations?error=${encodeURIComponent(
						tokenData.error_description || "Failed to get access token"
					)}`,
					request.url
				)
			);
		}

		// Get user info from Twitter
		const userResponse = await fetch("https://api.twitter.com/2/users/me", {
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
			},
		});

		const userData = await userResponse.json();

		// Store tokens and user info in your database
		// ...

		// Redirect back to success page
		return NextResponse.redirect(
			new URL(
				`/settings/integrations?success=true&platform=twitter&username=${userData.data.username}`,
				request.url
			)
		);
	} catch (error: any) {
		console.error("Twitter callback error:", error);
		return NextResponse.redirect(
			new URL(
				`/settings/integrations?error=${encodeURIComponent(error.message)}`,
				request.url
			)
		);
	}
}
