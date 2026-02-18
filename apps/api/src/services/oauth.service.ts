import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';

export type OAuthProvider = 'google' | 'github' | 'facebook';

export interface OAuthIdentity {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
  emailVerified: boolean;
  providerAccessToken?: string;
  providerRefreshToken?: string;
  providerTokenExpiry?: Date;
}

interface OAuthStatePayload {
  provider: OAuthProvider;
  nextPath: string;
  nonce: string;
}

interface OAuthCallbackResult {
  identity: OAuthIdentity;
  nextPath: string;
}

const SUPPORTED_PROVIDERS: OAuthProvider[] = ['google', 'github', 'facebook'];

async function getErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return response.statusText || 'OAuth request failed';
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const message =
      (typeof parsed.error_description === 'string' && parsed.error_description) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      (typeof parsed.message === 'string' && parsed.message) ||
      text;
    return message;
  } catch {
    return text;
  }
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (SUPPORTED_PROVIDERS as string[]).includes(value);
}

class OAuthService {
  isProvider(value: string): value is OAuthProvider {
    return isOAuthProvider(value);
  }

  getAuthorizationUrl(provider: OAuthProvider, nextPath?: string): string {
    const providerConfig = this.getProviderConfig(provider);
    const state = this.createStateToken(provider, nextPath);

    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: providerConfig.clientId,
        redirect_uri: providerConfig.callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    if (provider === 'github') {
      const params = new URLSearchParams({
        client_id: providerConfig.clientId,
        redirect_uri: providerConfig.callbackUrl,
        scope: 'read:user user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: providerConfig.callbackUrl,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForIdentity(
    provider: OAuthProvider,
    code: string,
    state: string,
  ): Promise<OAuthCallbackResult> {
    const statePayload = this.parseStateToken(provider, state);

    if (provider === 'google') {
      return {
        identity: await this.resolveGoogleIdentity(code),
        nextPath: statePayload.nextPath,
      };
    }

    if (provider === 'github') {
      return {
        identity: await this.resolveGithubIdentity(code),
        nextPath: statePayload.nextPath,
      };
    }

    return {
      identity: await this.resolveFacebookIdentity(code),
      nextPath: statePayload.nextPath,
    };
  }

  private normalizeNextPath(nextPath?: string): string {
    if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
      return '/';
    }
    return nextPath;
  }

  private createStateToken(provider: OAuthProvider, nextPath?: string): string {
    const payload: OAuthStatePayload = {
      provider,
      nextPath: this.normalizeNextPath(nextPath),
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    return jwt.sign(payload, config.jwt.secret, { expiresIn: '10m' });
  }

  private parseStateToken(provider: OAuthProvider, token: string): OAuthStatePayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Invalid state payload');
      }

      const payload = decoded as Partial<OAuthStatePayload>;
      if (payload.provider !== provider) {
        throw new Error('Provider mismatch');
      }

      return {
        provider,
        nonce: typeof payload.nonce === 'string' ? payload.nonce : '',
        nextPath: this.normalizeNextPath(payload.nextPath),
      };
    } catch {
      throw new AppError('Invalid or expired OAuth state', 400, 'INVALID_OAUTH_STATE');
    }
  }

  private getProviderConfig(provider: OAuthProvider) {
    const providerConfig = config.oauth[provider];
    if (
      !providerConfig.clientId ||
      !providerConfig.clientSecret ||
      !providerConfig.callbackUrl
    ) {
      throw new AppError(
        `${provider} OAuth is not configured`,
        503,
        'OAUTH_NOT_CONFIGURED',
      );
    }
    return providerConfig;
  }

  private getExpiryDate(rawValue: unknown): Date | undefined {
    const seconds = Number(rawValue);
    if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
    return new Date(Date.now() + seconds * 1000);
  }

  private async resolveGoogleIdentity(code: string): Promise<OAuthIdentity> {
    const providerConfig = this.getProviderConfig('google');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        redirect_uri: providerConfig.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new AppError(
        `Google token exchange failed: ${await getErrorMessage(tokenResponse)}`,
        401,
        'OAUTH_TOKEN_EXCHANGE_FAILED',
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) {
      throw new AppError('Google token response missing access token', 401, 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new AppError(
        `Google profile fetch failed: ${await getErrorMessage(profileResponse)}`,
        401,
        'OAUTH_PROFILE_FETCH_FAILED',
      );
    }

    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };

    if (!profile.sub || !profile.email) {
      throw new AppError('Google account did not return an email address', 400, 'OAUTH_EMAIL_REQUIRED');
    }

    return {
      provider: 'google',
      providerId: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
      avatar: profile.picture || null,
      emailVerified: Boolean(profile.email_verified),
      providerAccessToken: tokenData.access_token,
      providerRefreshToken: tokenData.refresh_token,
      providerTokenExpiry: this.getExpiryDate(tokenData.expires_in),
    };
  }

  private async resolveGithubIdentity(code: string): Promise<OAuthIdentity> {
    const providerConfig = this.getProviderConfig('github');

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        code,
        redirect_uri: providerConfig.callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      throw new AppError(
        `GitHub token exchange failed: ${await getErrorMessage(tokenResponse)}`,
        401,
        'OAUTH_TOKEN_EXCHANGE_FAILED',
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) {
      throw new AppError('GitHub token response missing access token', 401, 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ee-postmind',
    };

    const profileResponse = await fetch('https://api.github.com/user', { headers });
    if (!profileResponse.ok) {
      throw new AppError(
        `GitHub profile fetch failed: ${await getErrorMessage(profileResponse)}`,
        401,
        'OAUTH_PROFILE_FETCH_FAILED',
      );
    }

    const profile = (await profileResponse.json()) as {
      id?: number;
      email?: string | null;
      name?: string | null;
      login?: string;
      avatar_url?: string | null;
    };

    let email = profile.email ? profile.email.toLowerCase() : '';
    let emailVerified = false;

    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', { headers });
      if (!emailsResponse.ok) {
        throw new AppError(
          `GitHub email fetch failed: ${await getErrorMessage(emailsResponse)}`,
          401,
          'OAUTH_PROFILE_FETCH_FAILED',
        );
      }

      const emails = (await emailsResponse.json()) as Array<{
        email: string;
        verified: boolean;
        primary: boolean;
      }>;

      const bestEmail =
        emails.find((entry) => entry.primary && entry.verified) ||
        emails.find((entry) => entry.verified) ||
        emails.find((entry) => entry.primary);

      email = bestEmail?.email?.toLowerCase() || '';
      emailVerified = Boolean(bestEmail?.verified);
    } else {
      emailVerified = true;
    }

    if (!profile.id || !email) {
      throw new AppError('GitHub account did not return an email address', 400, 'OAUTH_EMAIL_REQUIRED');
    }

    return {
      provider: 'github',
      providerId: String(profile.id),
      email,
      name: profile.name || profile.login || email.split('@')[0],
      avatar: profile.avatar_url || null,
      emailVerified,
      providerAccessToken: tokenData.access_token,
      providerRefreshToken: tokenData.refresh_token,
      providerTokenExpiry: this.getExpiryDate(tokenData.expires_in),
    };
  }

  private async resolveFacebookIdentity(code: string): Promise<OAuthIdentity> {
    const providerConfig = this.getProviderConfig('facebook');
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', providerConfig.clientId);
    tokenUrl.searchParams.set('client_secret', providerConfig.clientSecret);
    tokenUrl.searchParams.set('redirect_uri', providerConfig.callbackUrl);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    if (!tokenResponse.ok) {
      throw new AppError(
        `Facebook token exchange failed: ${await getErrorMessage(tokenResponse)}`,
        401,
        'OAUTH_TOKEN_EXCHANGE_FAILED',
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) {
      throw new AppError('Facebook token response missing access token', 401, 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }

    const profileUrl = new URL('https://graph.facebook.com/v18.0/me');
    profileUrl.searchParams.set('fields', 'id,name,email,picture');
    profileUrl.searchParams.set('access_token', tokenData.access_token);

    const profileResponse = await fetch(profileUrl.toString());
    if (!profileResponse.ok) {
      throw new AppError(
        `Facebook profile fetch failed: ${await getErrorMessage(profileResponse)}`,
        401,
        'OAUTH_PROFILE_FETCH_FAILED',
      );
    }

    const profile = (await profileResponse.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };

    if (!profile.id || !profile.email) {
      throw new AppError('Facebook account did not return an email address', 400, 'OAUTH_EMAIL_REQUIRED');
    }

    return {
      provider: 'facebook',
      providerId: profile.id,
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
      avatar: profile.picture?.data?.url || null,
      emailVerified: true,
      providerAccessToken: tokenData.access_token,
      providerTokenExpiry: this.getExpiryDate(tokenData.expires_in),
    };
  }
}

export const oauthService = new OAuthService();
