import { NextResponse } from 'next/server';
import { clientPromise } from '../../../lib/mongodb';
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('content-scheduler');

    // Get counts
    const totalPosts = await db.collection('posts').countDocuments();
    const scheduled = await db.collection('posts').countDocuments({
      status: 'scheduled'
    });
    const published = await db.collection('posts').countDocuments({
      status: 'published'
    });
    const failed = await db.collection('posts').countDocuments({
      status: 'failed'
    });

    // Aggregation for platforms
    const platformStats = await db.collection('posts').aggregate([{
      $unwind: '$platforms'
    }, {
      $group: {
        _id: '$platforms',
        count: {
          $sum: 1
        }
      }
    }]).toArray();
    const postsPerPlatform: Record<string, number> = {};
    platformStats.forEach((stat: any) => {
      postsPerPlatform[stat._id] = stat.count;
    });
    return NextResponse.json({
      totalPosts,
      scheduled,
      published,
      failed,
      postsPerPlatform
    });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({
      error: 'Internal Server Error'
    }, {
      status: 500
    });
  }
}