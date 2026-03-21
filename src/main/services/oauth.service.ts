import http from 'http';
import crypto from 'crypto';
import { shell } from 'electron';

export interface OAuthConfig {
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType?: string;
}

export class OAuthService {
  private server: http.Server | null = null;

  async startFlow(config: OAuthConfig): Promise<{ code: string; codeVerifier: string }> {
    // Generate PKCE code verifier + challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    // Start local callback server
    const code = await new Promise<string>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost:3847');
        const returnedState = url.searchParams.get('state');
        const returnedCode = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authorization complete. You can close this window.</h1></body></html>');
        this.server?.close();

        if (error) return reject(new Error(`OAuth error: ${error}`));
        if (returnedState !== state) return reject(new Error('State mismatch'));
        if (!returnedCode) return reject(new Error('No authorization code'));
        resolve(returnedCode);
      });

      this.server.listen(3847);
    });

    // Open browser
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    shell.openExternal(authUrl.toString());

    return { code, codeVerifier };
  }

  async exchangeCode(config: OAuthConfig, code: string, codeVerifier: string): Promise<OAuthToken> {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) throw new Error(`Token exchange failed: ${response.statusText}`);
    return response.json();
  }

  stopServer(): void {
    this.server?.close();
    this.server = null;
  }
}
