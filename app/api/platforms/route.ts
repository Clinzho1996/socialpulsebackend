import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
	try {
		const user = await verifyToken(request);
		if (!user) {
			return NextResponse.json(
				{
					success: false,
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				},
				{ status: 401 }
			);
		}

		const { db } = await connectToDatabase();

		// FIX: Query using the Firebase UID as a plain string
		const platforms = await db
			.collection("platforms")
			.find({
				userId: user.userId, // <- No 'new ObjectId()' here
			})
			.toArray();

		return NextResponse.json({
			success: true,
			data: platforms.map((platform) => ({
				...platform,
				id: platform._id.toString(),
			})),
		});
	} catch (error: any) {
		console.error("Get platforms error:", error);
		return NextResponse.json(
			{
				success: false,
				error: {
					code: "SERVER_ERROR",
					message: error.message,
				},
			},
			{ status: 500 }
		);
	}
}
