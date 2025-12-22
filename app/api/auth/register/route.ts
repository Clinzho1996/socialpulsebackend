import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password,
      name
    } = await request.json();

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All fields are required'
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

    // Check if user exists
    const existingUser = await db.collection('users').findOne({
      email: email.toLowerCase()
    });
    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User already exists'
        }
      }, {
        status: 400
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'user',
      subscription: {
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        endDate: null
      },
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection('users').insertOne(newUser);

    // Generate JWT token
    const token = jwt.sign({
      userId: result.insertedId.toString(),
      email: newUser.email
    }, JWT_SECRET, {
      expiresIn: '7d'
    });

    // Return user without password
    const {
      password: _,
      ...userWithoutPassword
    } = newUser;
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: result.insertedId.toString(),
          ...userWithoutPassword
        },
        token
      }
    }, {
      status: 201
    });
  } catch (error: any) {
    console.error('Register error:', error);
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