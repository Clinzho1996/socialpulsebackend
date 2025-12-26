export type PlatformName = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type PostCategory = 'feed' | 'story' | 'reel' | 'tweet' | 'video';
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business';
export type BillingCycle = 'monthly' | 'yearly';
export interface Platform {
  _id: string;
  name: PlatformName;
  email: string;
  connected: boolean;
  username?: string;
  limits: {
    postsPerDay: number;
    postsPerWeek: number;
  };
  connectedAt?: string;
}
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: {
    name: string;
  }[];
  album: {
    name: string;
    images: {
      url: string;
      height: number;
      width: number;
    }[];
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  uri: string;
}
export interface Post {
  _id: string;
  content: string;
  platforms: PlatformName[];
  category: PostCategory;
  scheduledTime: string;
  status: PostStatus;
  mediaUrls?: string[];
  musicTrack?: SpotifyTrack;
  createdAt: string;
  updatedAt: string;
}
export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'pending';
  invitedAt: string;
}
export interface Subscription {
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  status: 'active' | 'cancelled' | 'expired';
  usage: {
    postsUsed: number;
    postsLimit: number;
  };
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}
export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  description: string;
  features: string[];
  limits: {
    postsPerDay: number;
    postsPerWeek: number;
    platforms: number;
    teamMembers: number;
    analytics: boolean;
    aiGeneration: boolean;
  };
  pricing: {
    monthly: number;
    yearly: number;
  };
  popular?: boolean;
}
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
}