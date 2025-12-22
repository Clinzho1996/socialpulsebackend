import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
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
      email,
      role
    } = await request.json();
    if (!email || !role) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and role are required'
        }
      }, {
        status: 400
      });
    }
    const {
      db
    } = await connectToDatabase();

    // Check if already invited
    const existing = await db.collection('team_members').findOne({
      workspaceId: new ObjectId(user.userId),
      email: email.toLowerCase()
    });
    if (existing) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_EXISTS',
          message: 'User already invited'
        }
      }, {
        status: 400
      });
    }
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const newMember = {
      workspaceId: new ObjectId(user.userId),
      email: email.toLowerCase(),
      role,
      status: 'pending',
      inviteToken,
      invitedAt: new Date()
    };
    await db.collection('team_members').insertOne(newMember);

    // TODO: Send invitation email

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully'
    });
  } catch (error: any) {
    console.error('Team invite error:', error);
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