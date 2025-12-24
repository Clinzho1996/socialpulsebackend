// /api/team/accept-invitation/route.ts
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { token } = await request.json();

		if (!token) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invitation token is required",
					},
				},
				{ status: 400 }
			);
		}

		const user = await verifyToken(request);
		if (!user) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "UNAUTHORIZED",
						message: "Authentication required",
					},
				},
				{ status: 401 }
			);
		}

		const { db } = await connectToDatabase();

		// Find invitation by token
		const invitation = await db.collection("team_members").findOne({
			inviteToken: token,
			status: "pending",
		});

		if (!invitation) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Invitation not found or already accepted",
					},
				},
				{ status: 404 }
			);
		}

		// Check if the user accepting is the same email as invited
		if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "EMAIL_MISMATCH",
						message: "This invitation was sent to a different email address",
					},
				},
				{ status: 403 }
			);
		}

		// Update the invitation to accepted
		await db.collection("team_members").updateOne(
			{ inviteToken: token },
			{
				$set: {
					status: "active",
					acceptedAt: new Date(),
					userId: user.userId, // Link to Firebase user ID
					userEmail: user.email,
					name: user.displayName || invitation.name,
				},
				$unset: {
					inviteToken: "", // Remove token after acceptance
				},
			}
		);

		return NextResponse.json({
			success: true,
			message: "Invitation accepted successfully",
		});
	} catch (error: any) {
		console.error("Accept invitation error:", error);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message || "Internal server error",
				},
			},
			{ status: 500 }
		);
	}
}
