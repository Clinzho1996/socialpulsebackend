import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';
export async function GET(request: NextRequest) {
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
      searchParams
    } = new URL(request.url);
    const range = searchParams.get('range') || 'week';
    const {
      db
    } = await connectToDatabase();
    const userId = new ObjectId(user.userId);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (range) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get post counts
    const totalPosts = await db.collection('posts').countDocuments({
      userId
    });
    const scheduled = await db.collection('posts').countDocuments({
      userId,
      status: 'scheduled'
    });
    const published = await db.collection('posts').countDocuments({
      userId,
      status: 'published'
    });
    const failed = await db.collection('posts').countDocuments({
      userId,
      status: 'failed'
    });

    // Get engagement stats (mock data - replace with actual analytics)
    const engagement = {
      total: 15420,
      likes: 8500,
      comments: 3200,
      shares: 3720
    };

    // Calculate trends (mock data)
    const trends = {
      posts: 12,
      engagement: 8
    };
    return NextResponse.json({
      success: true,
      data: {
        totalPosts,
        scheduled,
        published,
        failed,
        engagement,
        trends
      }
    });
  } catch (error: any) {
    console.error('Analytics overview error:', error);
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