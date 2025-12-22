import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || "smtp.gmail.com",
	port: parseInt(process.env.SMTP_PORT || "587"),
	secure: process.env.SMTP_SECURE === "true",
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASSWORD,
	},
});
export async function sendPasswordResetEmail(
	email: string,
	name: string,
	resetToken: string
): Promise<void> {
	const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
	const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>You requested to reset your password for your SocialPulseAI account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>SocialPulseAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
	await transporter.sendMail({
		from: `${process.env.EMAIL_FROM_NAME || "SocialPulseAI"} <${
			process.env.EMAIL_FROM || "noreply@socialpulseai.com"
		}>`,
		to: email,
		subject: "Password Reset Request - SocialPulseAI",
		html,
	});
}
export async function sendWelcomeEmail(
	email: string,
	name: string
): Promise<void> {
	const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to SocialPulseAI!</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Welcome to SocialPulseAI! We're excited to have you on board.</p>
          <p>You can now start scheduling posts across all your social media platforms.</p>
          <p>Best regards,<br>SocialPulseAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;
	await transporter.sendMail({
		from: `${process.env.EMAIL_FROM_NAME || "SocialPulseAI"} <${
			process.env.EMAIL_FROM || "noreply@socialpulseai.com"
		}>`,
		to: email,
		subject: "Welcome to SocialPulseAI!",
		html,
	});
}
