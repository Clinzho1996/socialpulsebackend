// In /api/team/members/route.ts
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

		console.log("🔍 User from token:", user);

		// Try to query with both ObjectId and string
		let query;

		if (/^[0-9a-fA-F]{24}$/.test(user.userId)) {
			// It's a valid ObjectId format
			console.log("✅ Valid ObjectId format");
			query = { workspaceId: new ObjectId(user.userId) };
		} else {
			// It's not an ObjectId, use string comparison
			console.log("⚠️ Not an ObjectId, using string comparison");
			query = { workspaceId: user.userId };
		}

		console.log("🔍 Query:", JSON.stringify(query));

		const members = await db.collection("team_members").find(query).toArray();

		console.log(`✅ Found ${members.length} members`);

		// Return empty array if no members found
		const formattedMembers = members.map((member) => ({
			id: member._id?.toString() || "",
			name: member.name || member.email.split("@")[0],
			email: member.email,
			role: member.role || "viewer",
			status: member.status || "pending",
			invitedAt: member.invitedAt?.toISOString() || new Date().toISOString(),
			createdAt: member.createdAt?.toISOString(),
			workspaceId: member.workspaceId?.toString(),
		}));

		return NextResponse.json({
			success: true,
			data: formattedMembers,
		});
	} catch (error: any) {
		console.error("❌ Get team members error:", error);
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
