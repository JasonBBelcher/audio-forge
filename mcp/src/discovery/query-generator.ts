import { GENRE_SEEDS, OBSCURITY_MODIFIERS, DECADE_MODIFIERS, REGION_MODIFIERS, getRandomElement } from './genre-seeds.js';
import { DiscoveryFilters } from '../queries/discovery-presets.js';

export class QueryGenerator {
  generateRandomQuery(filters?: DiscoveryFilters): string {
    const parts: string[] = [];

    // Pick a genre seed
    if (filters?.genres && filters.genres.length > 0) {
      const selectedGenre = filters.genres[Math.floor(Math.random() * filters.genres.length)];
      const seeds = GENRE_SEEDS[selectedGenre] ?? [];
      if (seeds.length > 0) {
        parts.push(getRandomElement(seeds));
      }
    } else {
      // Random genre
      const allGenres = Object.keys(GENRE_SEEDS);
      const randomGenre = getRandomElement(allGenres);
      const seeds = GENRE_SEEDS[randomGenre];
      parts.push(getRandomElement(seeds));
    }

    // Maybe add a region modifier
    if (filters?.regions && filters.regions.length > 0) {
      parts.push(getRandomElement(filters.regions));
    } else if (Math.random() > 0.5) {
      parts.push(getRandomElement(REGION_MODIFIERS));
    }

    // Maybe add a decade
    if (filters?.yearMin || filters?.yearMax) {
      const year = this.getRandomYearInRange(filters.yearMin, filters.yearMax);
      parts.push(year.toString());
    } else if (Math.random() > 0.4) {
      parts.push(getRandomElement(DECADE_MODIFIERS));
    }

    // Maybe add an obscurity modifier
    if (Math.random() > 0.6) {
      parts.push(getRandomElement(OBSCURITY_MODIFIERS));
    }

    return parts.join(' ');
  }

  buildYtDlpSearchArgs(query: string, maxResults: number = 50): string[] {
    return ['--dump-json', '--flat-playlist', `ytsearch${maxResults}:${query}`];
  }

  selectRandomResult(results: any[], maxViews?: number): any {
    // Filter by view count if obscurity dial is set
    let filtered = results;
    if (maxViews !== undefined) {
      filtered = results.filter((r) => (r.view_count ?? 0) <= maxViews);
    }

    // If all filtered out, use original results but prefer low-view items
    if (filtered.length === 0) {
      filtered = results;
    }

    // Weight toward lower view counts
    filtered.sort((a, b) => (a.view_count ?? 0) - (b.view_count ?? 0));
    const weights = filtered.map((_, idx) => Math.exp(-idx * 0.1)); // Exponential decay favoring first items
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < filtered.length; i++) {
      random -= weights[i];
      if (random <= 0) return filtered[i];
    }

    return filtered[filtered.length - 1];
  }

  private getRandomYearInRange(min?: number, max?: number): number {
    const yearMin = min ?? 1960;
    const yearMax = max ?? new Date().getFullYear();
    return Math.floor(Math.random() * (yearMax - yearMin + 1)) + yearMin;
  }
}
