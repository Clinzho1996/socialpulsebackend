// middleware.ts (in root of your backend)
import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
	"http://localhost:5173", // Your Vite dev server
	"http://localhost:3000", // Local Next.js
	"https://socialpulse.vercel.app", // Your production frontend
];

const corsOptions = {
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
	"Access-Control-Max-Age": "86400",
};

export function middleware(request: NextRequest) {
	const origin = request.headers.get("origin") ?? "";
	const isAllowedOrigin = allowedOrigins.includes(origin);

	// Handle preflight requests
	if (request.method === "OPTIONS") {
		const preflightHeaders = {
			...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
			"Access-Control-Allow-Credentials": "true",
			...corsOptions,
		};
		return NextResponse.json({}, { headers: preflightHeaders });
	}

	// Clone the response
	const response = NextResponse.next();

	if (isAllowedOrigin) {
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Access-Control-Allow-Credentials", "true");

		// Add CORS headers
		Object.entries(corsOptions).forEach(([key, value]) => {
			response.headers.set(key, value);
		});
	}

	return response;
}

export const config = {
	matcher: "/api/:path*",
};
