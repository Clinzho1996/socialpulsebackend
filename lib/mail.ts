// /lib/mail.ts
import nodemailer from "nodemailer";

interface EmailOptions {
	to: string;
	subject: string;
	html: string;
}

// Create transporter (configure with your email service)
const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST || "smtp.gmail.com",
	port: parseInt(process.env.EMAIL_PORT || "587"),
	secure: process.env.EMAIL_SECURE === "true",
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASSWORD,
	},
});

export async function sendEmail({ to, subject, html }: EmailOptions) {
	try {
		const info = await transporter.sendMail({
			from: `"SocialPulse" <${
				process.env.EMAIL_FROM || process.env.EMAIL_USER
			}>`,
			to,
			subject,
			html,
		});

		console.log("✅ Email sent:", info.messageId);
		return { success: true, messageId: info.messageId };
	} catch (error) {
		console.error("❌ Failed to send email:", error);
		throw error;
	}
}
