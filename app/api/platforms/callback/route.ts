import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';
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
      code,
      state
    } = await request.json();

    // TODO: Exchange code for access token with platform OAuth
    // This is a simplified version - implement actual OAuth flow

    const {
      db
    } = await connectToDatabase();

    // Check if platform already connected
    const existingPlatform = await db.collection('platforms').findOne({
      userId: new ObjectId(user.userId),
      name: platform
    });
    const platformData = {
      userId: new ObjectId(user.userId),
      name: platform,
      connected: true,
      username: `@user_${platform}`,
      // Replace with actual username from OAuth
      accessToken: 'encrypted_token',
      // Replace with actual encrypted token
      refreshToken: 'encrypted_refresh_token',
      tokenExpiry: new Date(Date.now() + 3600000),
      limits: {
        postsPerHour: 5,
        postsPerDay: 20
      },
      connectedAt: new Date(),
      lastSyncAt: new Date()
    };
    if (existingPlatform) {
      await db.collection('platforms').updateOne({
        _id: existingPlatform._id
      }, {
        $set: platformData
      });
    } else {
      await db.collection('platforms').insertOne(platformData);
    }
    return NextResponse.json({
      success: true,
      data: {
        platform,
        connected: true,
        username: platformData.username
      }
    });
  } catch (error: any) {
    console.error('Platform callback error:', error);
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