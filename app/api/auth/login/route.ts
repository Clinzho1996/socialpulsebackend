import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password
    } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
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
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      }, {
        status: 401
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      }, {
        status: 401
      });
    }

    // Generate JWT token
    const token = jwt.sign({
      userId: user._id.toString(),
      email: user.email
    }, JWT_SECRET, {
      expiresIn: '7d'
    });

    // Return user without password
    const {
      password: _,
      ...userWithoutPassword
    } = user;
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          ...userWithoutPassword
        },
        token
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
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