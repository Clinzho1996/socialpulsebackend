// /api/team/members/route.ts
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{}> } // No id parameter here
) {
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

		console.log("🔍 Getting members for Firebase user:", user.userId);

		// Query using Firebase UID as string
		const members = await db
			.collection("team_members")
			.find({ workspaceId: user.userId })
			.toArray();

		console.log(
			`✅ Found ${members.length} members for workspace ${user.userId}`
		);

		// Format the response
		const formattedMembers = members.map((member) => ({
			id: member._id?.toString() || "",
			name: member.name || member.email.split("@")[0],
			email: member.email,
			role: member.role || "viewer",
			status: member.status || "pending",
			invitedAt: member.invitedAt?.toISOString() || new Date().toISOString(),
			workspaceId: member.workspaceId,
			invitedBy: member.invitedBy,
		}));

		return NextResponse.json({
			success: true,
			data: formattedMembers,
		});
	} catch (error: any) {
		console.error("Get team members error:", error);
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
