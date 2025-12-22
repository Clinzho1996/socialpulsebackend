import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ postId: string }> } // params is a Promise
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
				{ status: 401 }
			);
		}

		// Await the params
		const { postId } = await params;

		const { db } = await connectToDatabase();
		const post = await db.collection("posts").findOne({
			_id: new ObjectId(postId),
			userId: new ObjectId(user.userId),
		});

		if (!post) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Post not found",
					},
				},
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			data: {
				...post,
				id: post._id.toString(),
			},
		});
	} catch (error: any) {
		console.error("Get post error:", error);
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

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ postId: string }> } // params is a Promise
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
				{ status: 401 }
			);
		}

		// Await the params
		const { postId } = await params;

		const body = await request.json();
		const { db } = await connectToDatabase();

		// Check if post exists and belongs to user
		const existingPost = await db.collection("posts").findOne({
			_id: new ObjectId(postId),
			userId: new ObjectId(user.userId),
		});

		if (!existingPost) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Post not found",
					},
				},
				{ status: 404 }
			);
		}

		// Update post
		const updateData: any = {
			...body,
			updatedAt: new Date(),
		};

		if (body.scheduledTime) {
			updateData.scheduledTime = new Date(body.scheduledTime);
		}

		await db
			.collection("posts")
			.updateOne({ _id: new ObjectId(postId) }, { $set: updateData });

		const updatedPost = await db.collection("posts").findOne({
			_id: new ObjectId(postId),
		});

		return NextResponse.json({
			success: true,
			data: {
				...updatedPost,
				id: updatedPost!._id.toString(),
			},
		});
	} catch (error: any) {
		console.error("Update post error:", error);
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

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ postId: string }> } // params is a Promise
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
				{ status: 401 }
			);
		}

		// Await the params
		const { postId } = await params;

		const { db } = await connectToDatabase();
		const result = await db.collection("posts").deleteOne({
			_id: new ObjectId(postId),
			userId: new ObjectId(user.userId),
		});

		if (result.deletedCount === 0) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Post not found",
					},
				},
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Post deleted successfully",
		});
	} catch (error: any) {
		console.error("Delete post error:", error);
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
