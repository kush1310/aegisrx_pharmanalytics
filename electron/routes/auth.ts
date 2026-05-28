import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '../db/index';
import { users } from '../db/schema';
import { sendOtpEmail } from '../services/mailService';

const JWT_SECRET = new TextEncoder().encode('suratpharma_jwt_secret_2026_secure');
const JWT_ISSUER = 'suratpharma';

function hashPassword(password: string): string {
  const salt = 'suratpharma_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const signupSchema = z.object({
  prefix: z.enum(['Mr.', 'Mrs.', 'Miss']),
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  birthDate: z.string().min(1, 'Birth date is required').trim(),
  email: z.string().email('Invalid email address').regex(emailRegex, 'Domain must contain a valid extension (e.g. .com, .in)').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const auth = new Hono();

// ── POST /api/auth/signup ───────────────────────────────────────────
auth.post('/signup', async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    
    const { prefix, firstName, lastName, birthDate, email, password } = parsed.data;
    const db = getDb();
    
    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return c.json({ success: false, error: 'User with this email already exists' }, 409);
    }

    const username = email.toLowerCase().trim();
    const passwordHash = hashPassword(password);

    const user = db.insert(users).values({
      username,
      prefix,
      firstName,
      lastName,
      birthDate,
      email,
      passwordHash,
      role: 'ADMIN'
    }).returning().get();

    return c.json({ 
      success: true, 
      message: 'User registered successfully', 
      data: { id: user.id, email: user.email } 
    }, 201);
  } catch (err: any) {
    console.error('[auth/signup]', err);
    return c.json({ success: false, error: err.message || 'Internal server error' }, 500);
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────
auth.post('/login', async (c) => {
  try {
    const { email, username, password } = await c.req.json();
    const identifier = email || username;
    if (!identifier || !password) {
      return c.json({ success: false, error: 'Email and password required' }, 400);
    }

    const db = getDb();
    let user;

    if (email) {
      const trimmedEmail = email.toLowerCase().trim();
      [user] = await db.select().from(users).where(eq(users.email, trimmedEmail)).limit(1);
    } else {
      [user] = await db.select().from(users).where(eq(users.username, identifier)).limit(1);
    }

    if (!user) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const hash = hashPassword(password);
    if (hash !== user.passwordHash) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const token = await new SignJWT({ 
      sub: String(user.id), 
      role: user.role, 
      username: user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || ''
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setExpirationTime('12h')
      .sign(JWT_SECRET);

    return c.json({
      success: true,
      data: { 
        token, 
        username: user.username, 
        role: user.role,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      }
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// ── POST /api/auth/forgot-password ──────────────────────────────────
auth.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) {
      return c.json({ success: false, error: 'Email is required' }, 400);
    }
    const cleanEmail = email.toLowerCase().trim();

    const db = getDb();
    const user = db.select().from(users).where(eq(users.email, cleanEmail)).get();
    if (!user) {
      return c.json({ success: false, error: 'No user registered with this email address' }, 404);
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(cleanEmail, { otp, expiresAt });

    await sendOtpEmail(cleanEmail, otp);

    return c.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (err: any) {
    console.error('[auth/forgot-password]', err);
    return c.json({ success: false, error: err.message || 'Internal server error' }, 500);
  }
});

// ── POST /api/auth/verify-otp ───────────────────────────────────────
auth.post('/verify-otp', async (c) => {
  try {
    const { email, otp } = await c.req.json();
    if (!email || !otp) {
      return c.json({ success: false, error: 'Email and verification code are required' }, 400);
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.trim();

    const record = otpStore.get(cleanEmail);
    if (!record) {
      return c.json({ success: false, error: 'Verification code not found or expired' }, 400);
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return c.json({ success: false, error: 'Verification code has expired' }, 400);
    }

    if (record.otp !== cleanOtp) {
      return c.json({ success: false, error: 'Invalid verification code' }, 400);
    }

    return c.json({
      success: true,
      message: 'Code verified successfully'
    });
  } catch (err: any) {
    console.error('[auth/verify-otp]', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────
auth.post('/reset-password', async (c) => {
  try {
    const { email, otp, newPassword, confirmPassword } = await c.req.json();
    if (!email || !otp || !newPassword || !confirmPassword) {
      return c.json({ success: false, error: 'All fields are required' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.trim();

    const record = otpStore.get(cleanEmail);
    if (!record || Date.now() > record.expiresAt || record.otp !== cleanOtp) {
      return c.json({ success: false, error: 'Verification code is invalid or expired' }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400);
    }

    if (newPassword !== confirmPassword) {
      return c.json({ success: false, error: 'Passwords do not match' }, 400);
    }

    const db = getDb();
    const user = db.select().from(users).where(eq(users.email, cleanEmail)).get();
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const newHash = hashPassword(newPassword);
    db.update(users).set({ passwordHash: newHash }).where(eq(users.email, cleanEmail)).run();

    otpStore.delete(cleanEmail);

    return c.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (err: any) {
    console.error('[auth/reset-password]', err);
    return c.json({ success: false, error: err.message || 'Internal server error' }, 500);
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────
auth.post('/change-password', async (c) => {
  try {
    const { email, currentPassword, newPassword, confirmPassword } = await c.req.json();
    if (!email || !currentPassword || !newPassword || !confirmPassword) {
      return c.json({ success: false, error: 'All fields are required' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();

    if (newPassword.length < 6) {
      return c.json({ success: false, error: 'New password must be at least 6 characters' }, 400);
    }

    if (newPassword !== confirmPassword) {
      return c.json({ success: false, error: 'New passwords do not match' }, 400);
    }

    const db = getDb();
    const user = db.select().from(users).where(eq(users.email, cleanEmail)).get();
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const currentHash = hashPassword(currentPassword);
    if (currentHash !== user.passwordHash) {
      return c.json({ success: false, error: 'Incorrect current password' }, 401);
    }

    const newHash = hashPassword(newPassword);
    db.update(users).set({ passwordHash: newHash }).where(eq(users.email, cleanEmail)).run();

    return c.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err: any) {
    console.error('[auth/change-password]', err);
    return c.json({ success: false, error: err.message || 'Internal server error' }, 500);
  }
});

export { auth, JWT_SECRET, JWT_ISSUER };
