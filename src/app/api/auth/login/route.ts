import { errorResponse, HttpError, login, startSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) throw new HttpError(400, 'Email and password are required');
    const user = login(String(email), String(password));
    if (!user) throw new HttpError(401, 'Wrong email or password');
    await startSession(user.id);
    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
