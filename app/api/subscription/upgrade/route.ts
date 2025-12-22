import { verifyToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
const PLAN_PRICES: any = {
	free: 0,
	starter: 19000,
	pro: 49000,
	business: 99000,
};
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
		const { plan, billingCycle } = await request.json();
		if (!plan || !PLAN_PRICES[plan]) {
			return NextResponse.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid plan",
					},
				},
				{
					status: 400,
				}
			);
		}
		const amount = PLAN_PRICES[plan];

		// Initialize Paystack payment
		const paystackResponse = await fetch(
			"https://api.paystack.co/transaction/initialize",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: user.email,
					amount: amount * 100,
					// Convert to kobo
					metadata: {
						userId: user.userId,
						plan,
						billingCycle,
					},
				}),
			}
		);
		const paystackData = await paystackResponse.json();
		if (!paystackData.status) {
			throw new Error("Failed to initialize payment");
		}
		return NextResponse.json({
			success: true,
			data: {
				paymentUrl: paystackData.data.authorization_url,
				reference: paystackData.data.reference,
			},
		});
	} catch (error: any) {
		console.error("Upgrade subscription error:", error);
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
