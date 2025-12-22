import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';
export async function DELETE(request: NextRequest, {
  params
}: {
  params: {
    platformId: string;
  };
}) {
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
    const result = await db.collection('platforms').deleteOne({
      _id: new ObjectId(params.platformId),
      userId: new ObjectId(user.userId)
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Platform not found'
        }
      }, {
        status: 404
      });
    }
    return NextResponse.json({
      success: true,
      message: 'Platform disconnected successfully'
    });
  } catch (error: any) {
    console.error('Platform disconnect error:', error);
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