import { NextResponse } from 'next/server';
import { generateBotToken } from '@/lib/security';

// GET /api/security/bot-token
// Returns a bot protection token for form submission
export async function GET() {
  const { token, timestamp } = generateBotToken();

  return NextResponse.json({
    success: true,
    data: {
      botToken: token,
      botTimestamp: timestamp,
    },
  });
}
