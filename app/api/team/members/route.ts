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
    const members = await db.collection('team_members').find({
      workspaceId: new ObjectId(user.userId)
    }).toArray();
    return NextResponse.json({
      success: true,
      data: members.map(member => ({
        ...member,
        id: member._id.toString()
      }))
    });
  } catch (error: any) {
    console.error('Get team members error:', error);
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