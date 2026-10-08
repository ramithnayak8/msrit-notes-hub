import { errorResponse, HttpError, register, startSession } from '@/lib/demo-auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) throw new HttpError(400, 'Enter a valid email');
    if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    let user;
    try {
      user = register(String(name), String(email), String(password));
    } catch {
      throw new HttpError(409, 'An account with this email already exists');
    }
    await startSession(user.id);
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
