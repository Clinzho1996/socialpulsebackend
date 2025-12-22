import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
export async function POST(request: NextRequest) {
  try {
    const {
      email
    } = await request.json();
    if (!email) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required'
        }
      }, {
        status: 400
      });
    }
    const {
      db
    } = await connectToDatabase();

    // Find user
    const user = await db.collection('users').findOne({
      email: email.toLowerCase()
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save token to database
    await db.collection('users').updateOne({
      _id: user._id
    }, {
      $set: {
        resetToken,
        resetTokenExpiry,
        updatedAt: new Date()
      }
    });

    // Send email
    await sendPasswordResetEmail(user.email, user.name, resetToken);
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
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