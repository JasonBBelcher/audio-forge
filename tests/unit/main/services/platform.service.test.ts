import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformService } from '../../../../src/main/services/platform.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('PlatformService', () => {
  let platform: PlatformService;

  beforeEach(() => {
    platform = new PlatformService(':memory:');
    vi.clearAllMocks();
  });

  it('registers a platform integration', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    expect(integration).toHaveProperty('id');
    expect(integration.name).toBe('spotify');
    expect(integration.status).toBe('registered');
  });

  it('stores platform credentials securely', async () => {
    const integration = await platform.registerIntegration({
      name: 'soundcloud',
      clientId: 'sc-id',
      clientSecret: 'sc-secret',
      redirectUri: 'http://localhost:3000/sc',
    });

    const creds = await platform.getIntegrationCredentials(integration.id);

    expect(creds).toBeDefined();
    expect(creds?.name).toBe('soundcloud');
    expect(creds?.clientId).toBe('sc-id');
  });

  it('authorizes platform access with OAuth', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const authCode = 'auth-code-123';
    const token = await platform.authorizeWithCode(integration.id, authCode);

    expect(token).toHaveProperty('accessToken');
    expect(token).toHaveProperty('refreshToken');
    expect(token).toHaveProperty('expiresIn');
  });

  it('refreshes expired OAuth tokens', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const authCode = 'auth-code-456';
    await platform.authorizeWithCode(integration.id, authCode);

    const refreshed = await platform.refreshToken(integration.id);

    expect(refreshed).toHaveProperty('accessToken');
    expect(refreshed).toHaveProperty('expiresIn');
  });

  it('publishes a track to platform', async () => {
    const integration = await platform.registerIntegration({
      name: 'soundcloud',
      clientId: 'sc-id',
      clientSecret: 'sc-secret',
      redirectUri: 'http://localhost:3000/sc',
    });

    const authCode = 'sc-auth-code';
    await platform.authorizeWithCode(integration.id, authCode);

    const trackPath = '/path/to/track.wav';
    const metadata = {
      title: 'My Track',
      description: 'An awesome track',
      tags: ['electronic', 'experimental'],
      isPublic: true,
    };

    const published = await platform.publishTrack(integration.id, trackPath, metadata);

    expect(published).toHaveProperty('id');
    expect(published.title).toBe('My Track');
    expect(published.platformUrl).toBeDefined();
  });

  it('fetches platform user profile', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const authCode = 'spotify-auth-code';
    await platform.authorizeWithCode(integration.id, authCode);

    const profile = await platform.getUserProfile(integration.id);

    expect(profile).toHaveProperty('id');
    expect(profile).toHaveProperty('displayName');
    expect(profile).toHaveProperty('email');
    expect(profile).toHaveProperty('followers');
  });

  it('searches for tracks on platform', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const authCode = 'spotify-auth-code';
    await platform.authorizeWithCode(integration.id, authCode);

    const results = await platform.searchTracks(integration.id, 'electronic music');

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('fetches user library/playlists', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const authCode = 'spotify-auth-code';
    await platform.authorizeWithCode(integration.id, authCode);

    const playlists = await platform.getPlaylists(integration.id);

    expect(Array.isArray(playlists)).toBe(true);
    expect(playlists.every((p) => p.id && p.name)).toBe(true);
  });

  it('adds track to playlist', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const authCode = 'spotify-auth-code';
    await platform.authorizeWithCode(integration.id, authCode);

    const success = await platform.addToPlaylist(integration.id, 'playlist-123', 'track-456');

    expect(success).toBe(true);
  });

  it('revokes platform authorization', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const authCode = 'spotify-auth-code';
    await platform.authorizeWithCode(integration.id, authCode);

    await platform.revokeAuthorization(integration.id);

    const creds = await platform.getIntegrationCredentials(integration.id);
    expect(creds?.status).toBe('unauthorized');
  });

  it('tracks publish history', async () => {
    const integration = await platform.registerIntegration({
      name: 'soundcloud',
      clientId: 'sc-id',
      clientSecret: 'sc-secret',
      redirectUri: 'http://localhost:3000/sc',
    });

    const authCode = 'sc-auth-code';
    await platform.authorizeWithCode(integration.id, authCode);

    await platform.publishTrack(integration.id, '/path/track1.wav', { title: 'Track 1' });
    await platform.publishTrack(integration.id, '/path/track2.wav', { title: 'Track 2' });

    const history = await platform.getPublishHistory(integration.id);

    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history.every((h) => h.platformId === integration.id)).toBe(true);
  });

  it('handles platform errors gracefully', async () => {
    const integration = await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const invalidCode = 'invalid-auth-code';

    await expect(platform.authorizeWithCode(integration.id, invalidCode)).rejects.toThrow();
  });

  it('lists all registered integrations', async () => {
    await platform.registerIntegration({
      name: 'spotify',
      clientId: 'spotify-id',
      clientSecret: 'spotify-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    await platform.registerIntegration({
      name: 'soundcloud',
      clientId: 'sc-id',
      clientSecret: 'sc-secret',
      redirectUri: 'http://localhost:3000/sc',
    });

    const integrations = await platform.listIntegrations();

    expect(integrations.length).toBeGreaterThanOrEqual(2);
    expect(integrations.some((i) => i.name === 'spotify')).toBe(true);
    expect(integrations.some((i) => i.name === 'soundcloud')).toBe(true);
  });
});
