import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { getDb } from '../db/index';
import { users } from '../db/schema';

const JWT_SECRET = new TextEncoder().encode('suratpharma_jwt_secret_2026_secure');
const JWT_ISSUER = 'suratpharma';

function hashPassword(password: string): string {
  const salt = 'suratpharma_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

const auth = new Hono();

auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    if (!username || !password) {
      return c.json({ success: false, error: 'Username and password required' }, 400);
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const hash = hashPassword(password);
    if (hash !== user.passwordHash) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const token = await new SignJWT({ sub: String(user.id), role: user.role, username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setExpirationTime('12h')
      .sign(JWT_SECRET);

    return c.json({
      success: true,
      data: { token, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { auth, JWT_SECRET, JWT_ISSUER };
