// In your backend route handler (/api/team/members/route.ts)
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

		const { db } = await connectToDatabase();

		// Debug: Log the userId to check its format
		console.log("User ID:", user.userId);

		// Try to create ObjectId, handle invalid format
		let workspaceId;
		try {
			workspaceId = new ObjectId(user.userId);
		} catch (error) {
			console.error("Invalid ObjectId format:", user.userId);
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "INVALID_ID",
						message: "Invalid user ID format",
					},
				},
				{
					status: 400,
				}
			);
		}

		const members = await db
			.collection("team_members")
			.find({ workspaceId })
			.toArray();

		return NextResponse.json({
			success: true,
			data: members.map((member) => ({
				id: member._id?.toString() || "",
				name: member.name || member.email.split("@")[0], // Fallback name
				email: member.email,
				role: member.role || "viewer",
				status: member.status || "pending",
				invitedAt: member.invitedAt?.toISOString() || new Date().toISOString(),
				createdAt: member.createdAt?.toISOString(),
				workspaceId: member.workspaceId?.toString(),
			})),
		});
	} catch (error: any) {
		console.error("Get team members error:", error);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message,
				},
			},
			{
				status: 500,
			}
		);
	}
}
