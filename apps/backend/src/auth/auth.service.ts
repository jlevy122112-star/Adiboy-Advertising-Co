import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/db';
import { AppError, UnauthorizedError, ValidationError } from '../common/errors';
import { generateTokenPair, verifyRefreshToken } from './tokens';
import {
  SignupPayload,
  LoginPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  TokenPair,
} from './auth.types';

export const authService = {
  // POST /auth/signup
  // Creates User + default Workspace + default Brand + sets level = 1
  async signup(payload: SignupPayload): Promise<TokenPair> {
    const { email, password, name } = payload;

    // Validate email not already used
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      throw new ValidationError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const workspaceId = uuidv4();

    // Create user record
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      email,
      password_hash: passwordHash,
      name,
      role: 'user',
    });
    if (userError) throw new AppError('Failed to create user');

    // Create default workspace
    const { error: wsError } = await supabase.from('workspaces').insert({
      id: workspaceId,
      owner_user_id: userId,
      name: `${name}'s Workspace`,
    });
    if (wsError) throw new AppError('Failed to create workspace');

    // Initialize brand settings
    await supabase.from('brands').insert({
      id: uuidv4(),
      workspace_id: workspaceId,
      name: '',
      industry: '',
      logo_url: '',
      primary_color: '#c9a84c',
      secondary_color: '#1a1a25',
    });

    // Set level = 1, xp = 0 (as specified in document)
    await supabase.from('user_progress').insert({
      id: uuidv4(),
      user_id: userId,
      level: 1,
      xp: 0,
    });

    return generateTokenPair({ userId, workspaceId, role: 'user', email });
  },

  // POST /auth/login
  async login(payload: LoginPayload): Promise<TokenPair> {
    const { email, password } = payload;

    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash, role')
      .eq('email', email)
      .single();

    if (!user) throw new UnauthorizedError('Invalid email or password');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    // Load workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_user_id', user.id)
      .single();

    const workspaceId = workspace?.id || '';

    return generateTokenPair({
      userId: user.id,
      workspaceId,
      role: user.role,
      email,
    });
  },

  // POST /auth/refresh
  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      return generateTokenPair(payload);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  },

  // POST /auth/forgot-password
  // Generates reset token, emails user, token expires in 15 minutes
  async forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
    const { email } = payload;
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) return; // Don't reveal whether email exists

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await supabase.from('password_reset_tokens').upsert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });

    // In production: send email via Supabase SMTP or Resend
    // supabase.auth.admin.generateLink({ type: 'recovery', email }) can also be used
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
  },

  // POST /auth/reset-password
  // Validates token, updates password hash, redirects to login
  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    const { token, password } = payload;

    const { data: record } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at')
      .eq('token', token)
      .single();

    if (!record) throw new ValidationError('Invalid or expired reset token');
    if (new Date(record.expires_at) < new Date()) {
      throw new ValidationError('Reset token has expired');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', record.user_id);

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('token', token);
  },
};
