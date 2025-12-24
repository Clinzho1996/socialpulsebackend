// /api/team/invite/route.ts
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
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
				{
					status: 401,
				}
			);
		}

		const { email, role } = await request.json();

		if (!email || !role) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Email and role are required",
					},
				},
				{
					status: 400,
				}
			);
		}

		const { db } = await connectToDatabase();

		console.log("🔍 User from Firebase:", user);
		console.log("🔍 Firebase UID:", user.userId);
		console.log("🔍 Email:", user.email);

		// Check if already invited
		const existing = await db.collection("team_members").findOne({
			workspaceId: user.userId, // Use Firebase UID directly as string
			email: email.toLowerCase(),
		});

		if (existing) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "ALREADY_EXISTS",
						message: "User already invited",
					},
				},
				{
					status: 400,
				}
			);
		}

		const inviteToken = crypto.randomBytes(32).toString("hex");
		const newMember = {
			workspaceId: user.userId, // Store Firebase UID as string
			email: email.toLowerCase(),
			role,
			status: "pending",
			inviteToken,
			invitedAt: new Date(),
			name: email.split("@")[0], // Default name
			// Optionally store Firebase user email as inviter
			invitedBy: user.email,
			invitedById: user.userId,
		};

		await db.collection("team_members").insertOne(newMember);

		// TODO: Send invitation email
		console.log("📧 Would send invitation email to:", email);

		return NextResponse.json({
			success: true,
			message: "Invitation sent successfully",
		});
	} catch (error: any) {
		console.error("Team invite error:", error);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message || "Internal server error",
				},
			},
			{
				status: 500,
			}
		);
	}
}
