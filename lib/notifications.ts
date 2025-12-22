// Notification System - Real-time notifications for post status changes
export type NotificationType =
	| "post_scheduled"
	| "post_published"
	| "post_failed"
	| "team_invite"
	| "subscription_updated";
export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	postId?: string;
	read: boolean;
	createdAt: string;
}

// In-app notification storage
const NOTIFICATIONS_KEY = "socialpulse_notifications";
export const notificationService = {
	// Get all notifications
	getAll: (): Notification[] => {
		const stored = localStorage.getItem(NOTIFICATIONS_KEY);
		return stored ? JSON.parse(stored) : [];
	},
	// Add new notification
	add: (notification: Omit<Notification, "id" | "read" | "createdAt">) => {
		const notifications = notificationService.getAll();
		const newNotification: Notification = {
			...notification,
			id: Date.now().toString(),
			read: false,
			createdAt: new Date().toISOString(),
		};
		notifications.unshift(newNotification);
		localStorage.setItem(
			NOTIFICATIONS_KEY,
			JSON.stringify(notifications.slice(0, 50))
		); // Keep last 50

		// Trigger custom event for UI updates
		window.dispatchEvent(
			new CustomEvent("notification", {
				detail: newNotification,
			})
		);

		// Show browser notification if permitted
		if ("Notification" in window && Notification.permission === "granted") {
			new Notification(newNotification.title, {
				body: newNotification.message,
				icon: "/logo.png",
			});
		}
		return newNotification;
	},
	// Mark as read
	markAsRead: (notificationId: string) => {
		const notifications = notificationService.getAll();
		const updated = notifications.map((n) =>
			n.id === notificationId
				? {
						...n,
						read: true,
				  }
				: n
		);
		localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
		window.dispatchEvent(new CustomEvent("notifications-updated"));
	},
	// Mark all as read
	markAllAsRead: () => {
		const notifications = notificationService.getAll();
		const updated = notifications.map((n) => ({
			...n,
			read: true,
		}));
		localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
		window.dispatchEvent(new CustomEvent("notifications-updated"));
	},
	// Get unread count
	getUnreadCount: (): number => {
		return notificationService.getAll().filter((n) => !n.read).length;
	},
	// Clear all notifications
	clearAll: () => {
		localStorage.removeItem(NOTIFICATIONS_KEY);
		window.dispatchEvent(new CustomEvent("notifications-updated"));
	},
	// Request browser notification permission
	requestPermission: async () => {
		if ("Notification" in window && Notification.permission === "default") {
			await Notification.requestPermission();
		}
	},
};

// Post status notification helpers
export const postNotifications = {
	scheduled: (postId: string, scheduledTime: string) => {
		notificationService.add({
			type: "post_scheduled",
			title: "Post Scheduled",
			message: `Your post has been scheduled for ${new Date(
				scheduledTime
			).toLocaleString()}`,
			postId,
		});
	},
	published: (postId: string, platforms: string[]) => {
		notificationService.add({
			type: "post_published",
			title: "Post Published Successfully",
			message: `Your post has been published to ${platforms.join(", ")}`,
			postId,
		});
	},
	failed: (postId: string, error: string) => {
		notificationService.add({
			type: "post_failed",
			title: "Post Failed",
			message: `Failed to publish post: ${error}`,
			postId,
		});
	},
};

// Email notification templates
export const emailTemplates = {
	postScheduled: (
		userName: string,
		postContent: string,
		scheduledTime: string,
		postLink: string
	) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .post-preview { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚡ Post Scheduled Successfully</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Your post has been scheduled and will be published on <strong>${new Date(
						scheduledTime
					).toLocaleString()}</strong>.</p>
          
          <div class="post-preview">
            <h3>Post Preview:</h3>
            <p>${postContent}</p>
          </div>
          
          <p>You can view and manage your scheduled post by clicking the button below:</p>
          <a href="${postLink}" class="button">View Post</a>
          
          <p>We'll send you another email once your post is published.</p>
          
          <p>Best regards,<br>The SocialPulse Team</p>
        </div>
        <div class="footer">
          <p>© 2024 SocialPulse. All rights reserved.</p>
          <p>You're receiving this email because you scheduled a post on SocialPulse.</p>
        </div>
      </div>
    </body>
    </html>
  `,
	postPublished: (
		userName: string,
		postContent: string,
		platforms: string[],
		postLinks: {
			platform: string;
			url: string;
		}[]
	) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .success-badge { background: #10b981; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 10px 0; }
        .post-preview { background: white; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 5px; }
        .platform-links { margin: 20px 0; }
        .platform-link { display: block; background: white; padding: 15px; margin: 10px 0; border-radius: 5px; text-decoration: none; color: #667eea; border: 1px solid #e5e7eb; }
        .platform-link:hover { background: #f3f4f6; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Post Published Successfully!</h1>
          <div class="success-badge">✓ Live Now</div>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Great news! Your post has been successfully published to <strong>${platforms.join(
						", "
					)}</strong>.</p>
          
          <div class="post-preview">
            <h3>Published Content:</h3>
            <p>${postContent}</p>
          </div>
          
          <div class="platform-links">
            <h3>View Your Post:</h3>
            ${postLinks
							.map(
								(link) => `
              <a href="${link.url}" class="platform-link">
                📱 View on ${
									link.platform.charAt(0).toUpperCase() + link.platform.slice(1)
								}
              </a>
            `
							)
							.join("")}
          </div>
          
          <p>Your post is now live and reaching your audience! Check your analytics dashboard to track engagement.</p>
          
          <p>Best regards,<br>The SocialPulse Team</p>
        </div>
        <div class="footer">
          <p>© 2024 SocialPulse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,
	postFailed: (
		userName: string,
		postContent: string,
		error: string,
		retryLink: string
	) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .error-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Post Publishing Failed</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>We encountered an issue while trying to publish your post.</p>
          
          <div class="error-box">
            <strong>Error:</strong> ${error}
          </div>
          
          <p><strong>Post Content:</strong></p>
          <p>${postContent}</p>
          
          <p>Don't worry! You can retry publishing this post or edit it before trying again.</p>
          <a href="${retryLink}" class="button">Retry Publishing</a>
          
          <p>If the problem persists, please contact our support team.</p>
          
          <p>Best regards,<br>The SocialPulse Team</p>
        </div>
        <div class="footer">
          <p>© 2024 SocialPulse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,
	teamInvite: (
		inviterName: string,
		inviteeEmail: string,
		workspaceName: string,
		acceptLink: string
	) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .invite-box { background: white; padding: 25px; margin: 20px 0; border-radius: 10px; text-align: center; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎊 You're Invited!</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on SocialPulse.</p>
          
          <div class="invite-box">
            <h2>Join ${workspaceName}</h2>
            <p>Collaborate on social media content and manage posts together.</p>
            <a href="${acceptLink}" class="button">Accept Invitation</a>
          </div>
          
          <p>SocialPulse helps teams schedule and manage social media content across multiple platforms.</p>
          
          <p>This invitation was sent to ${inviteeEmail}. If you don't want to join, you can ignore this email.</p>
          
          <p>Best regards,<br>The SocialPulse Team</p>
        </div>
        <div class="footer">
          <p>© 2024 SocialPulse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,
};
