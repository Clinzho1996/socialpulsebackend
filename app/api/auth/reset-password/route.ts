import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
export async function POST(request: NextRequest) {
  try {
    const {
      token,
      password
    } = await request.json();
    if (!token || !password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token and password are required'
        }
      }, {
        status: 400
      });
    }
    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 6 characters'
        }
      }, {
        status: 400
      });
    }
    const {
      db
    } = await connectToDatabase();

    // Find user with valid token
    const user = await db.collection('users').findOne({
      resetToken: token,
      resetTokenExpiry: {
        $gt: new Date()
      }
    });
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token'
        }
      }, {
        status: 400
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await db.collection('users').updateOne({
      _id: user._id
    }, {
      $set: {
        password: hashedPassword,
        updatedAt: new Date()
      },
      $unset: {
        resetToken: '',
        resetTokenExpiry: ''
      }
    });
    return NextResponse.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
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