export const GENRE_SEEDS: Record<string, string[]> = {
  soul: ['soul', 'northern soul', 'deep soul', 'southern soul', 'sweet soul', 'quiet storm'],
  funk: ['funk', 'deep funk', 'p-funk', 'afro funk', 'rare funk', 'synth funk'],
  jazz: ['jazz', 'modal jazz', 'spiritual jazz', 'ethio jazz', 'rare jazz', 'free jazz'],
  afrobeat: ['afrobeat', 'afro', 'highlife', 'jùjú', 'soukous', 'benga'],
  latin: ['latin', 'boogaloo', 'salsa', 'cumbia', 'tropicalia', 'mambo'],
  disco: ['disco', 'boogie', 'italo disco', 'space disco', 'deep disco', 'eurodisco'],
  psychedelic: ['psych', 'psychedelic', 'acid rock', 'krautrock', 'neo-psychedelia', 'psych pop'],
  library: ['library music', 'KPM', 'de wolfe', 'bruton', 'cavendish', 'library'],
  soundtrack: ['OST', 'film score', 'soundtrack', 'bande originale', 'instrumental', 'score'],
  reggae: ['reggae', 'dub', 'rocksteady', 'dancehall', 'lovers rock', 'roots reggae'],
  hiphop: ['hip hop instrumental', 'boom bap', 'lo-fi', 'rap', 'trap', 'conscious hip hop'],
  electronic: ['synth', 'electro', 'breakbeat', 'ambient', 'techno', 'house'],
  world: ['world music', 'ethno', 'tribal', 'folk', 'world beat', 'traditional'],
  rock: ['garage rock', 'surf rock', 'prog rock', 'post-punk', 'glam rock', 'hard rock'],
  rnb: ['r&b', 'rhythm and blues', 'quiet storm', 'new jack swing', 'soul funk', 'neo-soul'],
  gospel: ['gospel', 'spiritual', 'church', 'choir', 'soul gospel', 'contemporary gospel'],
  blues: ['blues', 'delta blues', 'chicago blues', 'electric blues', 'country blues', 'boogie blues'],
  country: ['country', 'honky tonk', 'outlaw country', 'bluegrass', 'country folk', 'country rock'],
  classical: ['classical', 'baroque', 'romantic', 'chamber music', 'symphony', 'concerto'],
  easy_listening: ['easy listening', 'soft rock', 'yacht rock', 'adult contemporary', 'lounge'],
};

export const OBSCURITY_MODIFIERS = ['rare', 'obscure', 'unknown', 'forgotten', 'unreleased', 'private press', 'deep cut', 'vinyl'];

export const DECADE_MODIFIERS = ['60s', '70s', '80s', '90s', '2000s', '50s', '1960s', '1970s', '1980s', '1990s'];

export const REGION_MODIFIERS = [
  'japanese',
  'brazilian',
  'turkish',
  'thai',
  'korean',
  'nigerian',
  'colombian',
  'indian',
  'greek',
  'peruvian',
  'ethiopian',
  'ghanaian',
  'congolese',
  'indonesian',
  'vietnamese',
  'cuban',
  'jamaican',
  'argentinian',
  'moroccan',
  'senegalese',
];

export function getAvailableGenres(): string[] {
  return Object.keys(GENRE_SEEDS);
}

export function getGenreSeeds(genre: string): string[] {
  return GENRE_SEEDS[genre] ?? [];
}

export function getAvailableRegions(): string[] {
  return REGION_MODIFIERS;
}

export function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
