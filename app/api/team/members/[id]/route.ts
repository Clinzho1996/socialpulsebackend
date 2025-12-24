// /api/team/members/[id]/route.ts
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Await the params Promise in Next.js 15
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

		// Find the member first to verify ownership
		const member = await db.collection("team_members").findOne({
			_id: new ObjectId(memberId),
			workspaceId: user.userId, // Verify it belongs to current user's workspace
		});

		if (!member) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Team member not found or you do not have permission",
					},
				},
				{
					status: 404,
				}
			);
		}

		// Delete the member
		await db.collection("team_members").deleteOne({
			_id: new ObjectId(memberId),
		});

		return NextResponse.json({
			success: true,
			message: "Team member removed successfully",
		});
	} catch (error: any) {
		console.error("Delete team member error:", error);

		// Handle invalid ObjectId
		if (error.message?.includes("input must be a 24 character hex string")) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "INVALID_ID",
						message: "Invalid team member ID format",
					},
				},
				{
					status: 400,
				}
			);
		}

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
