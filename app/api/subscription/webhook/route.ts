import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '').update(body).digest('hex');
    const signature = request.headers.get('x-paystack-signature');
    if (hash !== signature) {
      return NextResponse.json({
        success: false,
        error: 'Invalid signature'
      }, {
        status: 401
      });
    }
    const event = JSON.parse(body);
    if (event.event === 'charge.success') {
      const {
        metadata,
        customer
      } = event.data;
      const {
        userId,
        plan,
        billingCycle
      } = metadata;
      const {
        db
      } = await connectToDatabase();

      // Update user subscription
      await db.collection('users').updateOne({
        _id: new ObjectId(userId)
      }, {
        $set: {
          'subscription.plan': plan,
          'subscription.status': 'active',
          'subscription.startDate': new Date(),
          'subscription.endDate': new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
          updatedAt: new Date()
        }
      });

      // Create subscription record
      await db.collection('subscriptions').insertOne({
        userId: new ObjectId(userId),
        plan,
        billingCycle,
        amount: event.data.amount / 100,
        reference: event.data.reference,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      });
    }
    return NextResponse.json({
      success: true
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, {
      status: 500
    });
  }
}