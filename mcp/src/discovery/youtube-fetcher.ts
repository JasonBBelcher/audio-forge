import { run } from '../utils/process-runner.js';

export interface SearchResult {
  id: string;
  title: string;
  uploader: string | null;
  upload_date: string | null;
  duration: number | null;
  view_count: number | null;
  thumbnail: string | null;
  description: string | null;
}

export interface VideoDetails {
  id: string;
  title: string;
  uploader: string | null;
  upload_date: string | null;
  duration: number | null;
  view_count: number | null;
  thumbnail: string | null;
  description: string | null;
  ext: string;
}

export class YouTubeFetcher {
  async searchVideos(query: string, maxResults: number = 50): Promise<SearchResult[]> {
    const args = ['--dump-json', '--flat-playlist', `ytsearch${maxResults}:${query}`];
    const result = await run('yt-dlp', args, 30_000);

    if (result.exitCode !== 0) {
      throw new Error(`yt-dlp search failed: ${result.stderr}`);
    }

    const lines = result.stdout.trim().split('\n').filter((line) => line.length > 0);
    const videos: SearchResult[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line) as Record<string, unknown>;
        videos.push({
          id: (data.id ?? data.url) as string,
          title: (data.title ?? 'Unknown') as string,
          uploader: (data.uploader ?? null) as string | null,
          upload_date: (data.upload_date ?? null) as string | null,
          duration: (data.duration ?? null) as number | null,
          view_count: (data.view_count ?? null) as number | null,
          thumbnail: (data.thumbnail ?? null) as string | null,
          description: (data.description ?? null) as string | null,
        });
      } catch {
        // Skip malformed lines
      }
    }

    return videos;
  }

  async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const result = await run('yt-dlp', ['-j', url], 15_000);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to fetch details for ${videoId}: ${result.stderr}`);
    }

    const data = JSON.parse(result.stdout) as Record<string, unknown>;
    return {
      id: videoId,
      title: (data.title ?? 'Unknown') as string,
      uploader: (data.uploader ?? null) as string | null,
      upload_date: (data.upload_date ?? null) as string | null,
      duration: (data.duration ?? null) as number | null,
      view_count: (data.view_count ?? null) as number | null,
      thumbnail: (data.thumbnail ?? null) as string | null,
      description: (data.description ?? null) as string | null,
      ext: (data.ext ?? 'unknown') as string,
    };
  }

  async getMultipleDetails(videoIds: string[]): Promise<VideoDetails[]> {
    const results: VideoDetails[] = [];

    for (const id of videoIds) {
      try {
        const details = await this.getVideoDetails(id);
        results.push(details);
      } catch (err) {
        // Skip failed lookups
      }
    }

    return results;
  }
}
