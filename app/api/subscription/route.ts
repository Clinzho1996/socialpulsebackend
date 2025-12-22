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
      db
    } = await connectToDatabase();
    const userData = await db.collection('users').findOne({
      _id: new ObjectId(user.userId)
    });
    if (!userData) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      }, {
        status: 404
      });
    }

    // Get usage stats
    const postsUsed = await db.collection('posts').countDocuments({
      userId: new ObjectId(user.userId),
      createdAt: {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    });
    const limits: any = {
      free: 5,
      starter: 30,
      pro: 100,
      business: 9999
    };
    return NextResponse.json({
      success: true,
      data: {
        plan: userData.subscription.plan,
        status: userData.subscription.status,
        usage: {
          postsUsed,
          postsLimit: limits[userData.subscription.plan] || 5
        },
        billingCycle: 'monthly',
        nextBillingDate: userData.subscription.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 0
      }
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
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