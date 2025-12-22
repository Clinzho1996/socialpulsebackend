export interface PaystackConfig {
	email: string;
	amount: number; // Amount in kobo (e.g., 10000 = 100 NGN)
	reference?: string;
	publicKey: string;
	onSuccess: (response: any) => void;
	onClose: () => void;
	metadata?: Record<string, any>;
}

// Paystack public key - REPLACE with your actual key from Paystack dashboard
export const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

export const PLANS = {
	free: {
		name: "Free",
		price: 0,
		features: [
			"1 post per day",
			"5 posts per week",
			"2 social platforms",
			"Basic analytics",
			"Email support",
		],
		limits: {
			postsPerDay: 1,
			postsPerWeek: 5,
			platforms: 2,
		},
	},
	starter: {
		name: "Starter",
		price: 19000, // ₦190.00 (in Naira)
		features: [
			"5 posts per day",
			"30 posts per week",
			"5 social platforms",
			"Advanced analytics",
			"AI content generation",
			"Priority email support",
		],
		limits: {
			postsPerDay: 5,
			postsPerWeek: 30,
			platforms: 5,
		},
	},
	pro: {
		name: "Pro",
		price: 49000, // ₦490.00
		features: [
			"15 posts per day",
			"100 posts per week",
			"All social platforms",
			"Advanced analytics & reports",
			"Unlimited AI generation",
			"Team collaboration (5 members)",
			"Priority support",
		],
		limits: {
			postsPerDay: 15,
			postsPerWeek: 100,
			platforms: 10,
		},
	},
	business: {
		name: "Business",
		price: 99000, // ₦990.00
		features: [
			"Unlimited posts",
			"Unlimited platforms",
			"White-label analytics",
			"Unlimited AI generation",
			"Unlimited team members",
			"API access",
			"Dedicated account manager",
			"24/7 priority support",
		],
		limits: {
			postsPerDay: 999,
			postsPerWeek: 9999,
			platforms: 999,
		},
	},
};

/**
 * Initialize Paystack payment
 */
export const initializePayment = (
	config: Omit<PaystackConfig, "publicKey">
) => {
	// Dynamically import react-paystack to avoid SSR issues
	const { usePaystackPayment } = require("react-paystack");

	const paystackConfig = {
		reference:
			config.reference ||
			`socialpulse${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		email: config.email,
		amount: config.amount,
		publicKey: PAYSTACK_PUBLIC_KEY,
		currency: "NGN",
		metadata: {
			custom_fields: [],
			...config.metadata,
		},
	};

	// Create the payment component
	const initializePayment = usePaystackPayment(paystackConfig);

	return () => {
		initializePayment({
			onSuccess: (response: any) => {
				console.log("Payment successful:", response);
				config.onSuccess(response);
			},
			onClose: () => {
				console.log("Payment modal closed");
				config.onClose();
			},
		});
	};
};
