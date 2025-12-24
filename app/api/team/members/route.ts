// If you have GET /api/team/members/[id]/route.ts
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: memberId } = await params;

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

		const member = await db.collection("team_members").findOne({
			_id: new ObjectId(memberId),
			workspaceId: user.userId,
		});

		if (!member) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Team member not found",
					},
				},
				{
					status: 404,
				}
			);
		}

		return NextResponse.json({
			success: true,
			data: {
				id: member._id.toString(),
				name: member.name || member.email.split("@")[0],
				email: member.email,
				role: member.role || "viewer",
				status: member.status || "pending",
				invitedAt: member.invitedAt?.toISOString(),
				workspaceId: member.workspaceId,
			},
		});
	} catch (error: any) {
		console.error("Get team member error:", error);
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
