import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';
const OAUTH_CONFIGS: any = {
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scope: 'tweet.read tweet.write users.read offline.access'
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scope: 'pages_manage_posts,pages_read_engagement'
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    scope: 'user_profile,user_media'
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scope: 'w_member_social,r_liteprofile'
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/auth/authorize/',
    scope: 'user.info.basic,video.upload'
  }
};
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, {
        status: 401
      });
    }
    const {
      platform,
      redirectUri
    } = await request.json();
    if (!platform || !OAUTH_CONFIGS[platform]) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid platform'
        }
      }, {
        status: 400
      });
    }
    const config = OAUTH_CONFIGS[platform];
    const state = crypto.randomBytes(16).toString('hex');

    // Get client ID from environment
    const clientIdKey = `${platform.toUpperCase()}_CLIENT_ID`;
    const clientId = process.env[`VITE_${clientIdKey}`];
    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: `${platform} OAuth not configured`
        }
      }, {
        status: 500
      });
    }

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scope,
      state
    });
    const authUrl = `${config.authUrl}?${params.toString()}`;
    return NextResponse.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
  } catch (error: any) {
    console.error('Platform connect error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    }, {
      status: 500
    });
  }
}