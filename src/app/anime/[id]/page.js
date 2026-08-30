// src/app/anime/[id]/page.jsx - With Others section and improved season grouping
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';

export const revalidate = 3600;

const ANILIST_API = 'https://graphql.anilist.co';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

async function fetchAniList(query, variables) {
  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json' 
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('AniList fetch error:', error);
    return null;
  }
}

async function getAnimeData(animeId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title { romaji english native }
        coverImage { large extraLarge }
        bannerImage
        averageScore
        episodes
        duration
        status
        season
        seasonYear
        format
        genres
        description
        countryOfOrigin
        isAdult
        studios { nodes { id name } }
        nextAiringEpisode { episode airingAt timeUntilAiring }
        airingSchedule { nodes { episode airingAt } }
        relations {
          edges {
            relationType
            node {
              id
              idMal
              title { romaji english native }
              format
              type
              episodes
              seasonYear
              coverImage { large }
              averageScore
              status
            }
          }
        }
        characters(sort: ROLE, perPage: 12) {
          edges {
            node {
              id
              name { full }
              image { medium large }
            }
            role
            voiceActors(language: JAPANESE, sort: RELEVANCE) {
              id
              name { full }
              image { medium large }
            }
          }
        }
        staff(sort: RELEVANCE, perPage: 8) {
          edges {
            node {
              id
              name { full }
              image { medium large }
              primaryOccupations
            }
            role
          }
        }
        recommendations(sort: RATING_DESC, perPage: 12) {
          nodes {
            mediaRecommendation {
              id
              idMal
              title { romaji english native }
              coverImage { large }
              format
              episodes
              seasonYear
              averageScore
              status
            }
          }
        }
      }
    }
  `;

  const data = await fetchAniList(query, { id: Number(animeId) });
  return data?.data?.Media || null;
}

function formatTimeUntilAiring(seconds) {
  if (!seconds || seconds <= 0) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${minutes}m`;
}

function getAiredEpisodes(media) {
  if (!media) return [];
  
  const now = Math.floor(Date.now() / 1000);
  const airedSchedule = media.airingSchedule?.nodes || [];
  
  if (media.status === 'FINISHED' && media.episodes) {
    return Array.from({ length: Math.min(media.episodes, 1000) }, (_, i) => i + 1);
  }
  
  if (airedSchedule.length > 0) {
    return airedSchedule
      .filter(node => node.airingAt && node.airingAt <= now)
      .map(node => node.episode)
      .sort((a, b) => a - b);
  }
  
  if (media.nextAiringEpisode?.episode) {
    const totalAired = Math.min(media.nextAiringEpisode.episode - 1, 1000);
    return Array.from({ length: Math.max(totalAired, 1) }, (_, i) => i + 1);
  }
  
  return [1];
}

function formatFormat(format) {
  const formats = {
    'TV': 'TV',
    'MOVIE': 'Movie',
    'OVA': 'OVA',
    'ONA': 'ONA',
    'SPECIAL': 'Special',
    'TV_SHORT': 'Short',
    'MUSIC': 'Music',
  };
  return formats[format] || format || 'Other';
}

// Helper to check if title contains season indicators
function isSeasonTitle(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  const seasonKeywords = ['season', 'part', 'cour', 'arc', 'chapter', 'act'];
  for (const keyword of seasonKeywords) {
    if (lower.includes(keyword)) return true;
  }
  // Check for numbers at end (e.g., "Bleach 2")
  if (/\s\d+$/.test(lower)) return true;
  // Check for Roman numerals at end
  if (/\s[i,v,x]+$/i.test(lower)) return true;
  return false;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const anime = await getAnimeData(id);
  if (!anime) return { title: 'Anime Not Found' };

  const title = anime.title?.english || anime.title?.romaji || anime.title?.native || 'Unknown';
  return {
    title: `${title} — Anime Info`,
    description: anime.description
      ? anime.description.replace(/<[^>]*>/g, '').slice(0, 160)
      : undefined,
    openGraph: {
      title,
      images: anime.coverImage?.extraLarge ? [anime.coverImage.extraLarge] : [],
    },
  };
}

export default async function AnimePage({ params }) {
  const { id } = await params;
  
  const anime = await getAnimeData(id);

  if (!anime) {
    return (
      <main className="siteShell">
        <Header />
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '64px' }}>🎌</span>
          <h1>Anime Not Found</h1>
          <p style={{ color: '#999', marginBottom: '20px' }}>
            We couldn't find this anime. It may have been removed or the ID is incorrect.
          </p>
          <Link href="/search" className="button buttonPrimary">← Back to Search</Link>
        </div>
      </main>
    );
  }

  const title = anime.title?.english || anime.title?.romaji || anime.title?.native || 'Unknown';
  const image = anime.coverImage?.extraLarge || anime.coverImage?.large || null;
  const hasBanner = isValidUrl(anime.bannerImage);
  const studios = anime.studios?.nodes || [];
  const episodes = getAiredEpisodes(anime);
  const isUpcoming = anime.nextAiringEpisode && 
    anime.nextAiringEpisode.airingAt > Math.floor(Date.now() / 1000);
  const characters = anime.characters?.edges || [];
  const staff = anime.staff?.edges || [];
  const recommendations = anime.recommendations?.nodes || [];
  const relations = anime.relations?.edges || [];

  // Build related seasons - include ALL TV relations, plus anything with "season" in title
  const allRelatedSeasons = relations
    .filter(e => {
      const format = e.node.format;
      const title = e.node.title?.english || e.node.title?.romaji || e.node.title?.native || '';
      // Include TV/Short formats AND anything with season in title
      return (format === 'TV' || format === 'TV_SHORT' || isSeasonTitle(title)) &&
        ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT', 'CHILD'].includes(e.relationType);
    })
    .map(e => ({
      id: e.node.id,
      title: e.node.title?.english || e.node.title?.romaji || e.node.title?.native || 'Unknown',
      episodes: e.node.episodes,
      seasonYear: e.node.seasonYear,
      coverImage: e.node.coverImage?.large || null,
      format: e.node.format,
      averageScore: e.node.averageScore,
      status: e.node.status,
      relationType: e.relationType,
    }))
    .sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

  // Group seasons by franchise/series name (remove season/part indicators)
  const seasonGroups = {};
  allRelatedSeasons.forEach(season => {
    let baseName = season.title;
    // Remove common season indicators
    baseName = baseName.replace(/\s*season\s*\d+/i, '');
    baseName = baseName.replace(/\s*part\s*\d+/i, '');
    baseName = baseName.replace(/\s*cour\s*\d+/i, '');
    baseName = baseName.replace(/\s*\d+$/i, '');
    baseName = baseName.replace(/\s*[i,v,x]+$/i, '');
    baseName = baseName.trim();
    
    if (!seasonGroups[baseName]) {
      seasonGroups[baseName] = [];
    }
    seasonGroups[baseName].push(season);
  });

  // Flatten and sort all seasons
  const relatedSeasons = [];
  for (const [groupName, seasons] of Object.entries(seasonGroups)) {
    // Sort each group by year
    seasons.sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));
    relatedSeasons.push(...seasons);
  }

  // Other related media (movies, OVAs, specials, etc.)
  const otherRelated = relations
    .filter(e => {
      const format = e.node.format;
      return format === 'MOVIE' || format === 'OVA' || format === 'SPECIAL' || format === 'ONA';
    })
    .map(e => ({
      id: e.node.id,
      title: e.node.title?.english || e.node.title?.romaji || e.node.title?.native || 'Unknown',
      format: e.node.format,
      relationType: e.relationType,
      seasonYear: e.node.seasonYear,
    }))
    .sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0));

  return (
    <main className="siteShell">
      <Header />

      <style dangerouslySetInnerHTML={{
        __html: `
          .recommendation-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .recommendation-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(76, 175, 80, 0.15);
            border-color: rgba(76, 175, 80, 0.3) !important;
          }
          .recommendation-card:hover .recommendation-image {
            transform: scale(1.05);
          }
          .recommendation-image {
            transition: transform 0.3s ease;
          }
          .season-link {
            transition: all 0.3s ease;
          }
          .season-link:hover {
            background: rgba(76, 175, 80, 0.15) !important;
            border-color: rgba(76, 175, 80, 0.3) !important;
          }
          .related-link {
            transition: all 0.3s ease;
          }
          .related-link:hover {
            background: rgba(76, 175, 80, 0.1) !important;
            border-color: rgba(76, 175, 80, 0.2) !important;
          }
          .staff-link:hover {
            background: rgba(76, 175, 80, 0.1) !important;
            border-color: rgba(76, 175, 80, 0.2) !important;
          }
          .character-card:hover {
            background: rgba(76, 175, 80, 0.05) !important;
            border-color: rgba(76, 175, 80, 0.15) !important;
          }
          .watch-button:hover {
            background: #45a049 !important;
            transform: scale(1.02);
          }
        `
      }} />

      {hasBanner && (
        <div
          style={{
            height: '300px',
            backgroundImage: `url(${anime.bannerImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
          }}
          role="presentation"
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(180deg, transparent 0%, #0a0a0a 100%)',
          }} />
        </div>
      )}

      <div style={{
        maxWidth: '1100px',
        margin: hasBanner ? '-50px auto 40px' : '40px auto',
        padding: '0 20px',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '30px',
        position: 'relative',
      }}>
        <div>
          {isValidUrl(image) ? (
            <img
              src={image}
              alt={title}
              style={{ width: '100%', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2/3', background: '#1a1a1a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🎌</div>
          )}

          {episodes.length > 0 && (
            <Link href={`/anime/watch/${anime.id}/${episodes[0]}`} className="watch-button" style={{
              display: 'block', textAlign: 'center', marginTop: '15px', padding: '12px',
              background: '#4caf50', color: '#fff', textDecoration: 'none', borderRadius: '25px', fontWeight: '600',
            }}>
              ▶ Watch Now
            </Link>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <a
              href={`https://anilist.co/anime/${anime.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 12px', background: 'rgba(255, 255, 255, 0.1)', color: '#fff',
                textDecoration: 'none', borderRadius: '5px', fontSize: '0.8rem',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              AniList
            </a>
            {anime.idMal && (
              <a
                href={`https://myanimelist.net/anime/${anime.idMal}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '6px 12px', background: 'rgba(46, 160, 67, 0.2)', color: '#2ea043',
                  textDecoration: 'none', borderRadius: '5px', fontSize: '0.8rem',
                  border: '1px solid rgba(46, 160, 67, 0.3)',
                }}
              >
                MAL
              </a>
            )}
          </div>
        </div>

        <div>
          <p style={{ color: '#4caf50', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Anime
          </p>
          <h1 style={{ fontSize: '2.2rem', margin: '10px 0 5px' }}>{title}</h1>

          {anime.title?.native && anime.title.native !== title && (
            <p style={{ color: '#999', fontSize: '1rem', margin: '0 0 10px' }}>{anime.title.native}</p>
          )}

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px', color: '#999' }}>
            {anime.averageScore > 0 && (
              <span style={{ color: '#ffd700', fontWeight: '600' }}>★ {(anime.averageScore / 10).toFixed(1)}</span>
            )}
            {anime.seasonYear && <span>{anime.seasonYear}</span>}
            {anime.episodes && <span>{anime.episodes} eps</span>}
            {anime.status && <span>{anime.status}</span>}
            {anime.format && <span>{anime.format}</span>}
            {anime.duration && <span>{anime.duration} min</span>}
          </div>

          {isUpcoming && (
            <div style={{
              padding: '8px 16px',
              background: 'rgba(76, 175, 80, 0.15)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: '8px',
              marginBottom: '15px',
              display: 'inline-flex',
              gap: '10px',
              alignItems: 'center',
            }}>
              <span style={{ color: '#4caf50', fontWeight: '600' }}>
                Next: Episode {anime.nextAiringEpisode.episode}
              </span>
              {anime.nextAiringEpisode.timeUntilAiring > 0 && (
                <span style={{ color: '#ffd700' }}>
                  in {formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}
                </span>
              )}
            </div>
          )}

          {anime.genres && anime.genres.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
              {anime.genres.map((genre, index) => (
                <span key={`${genre}-${index}`} style={{
                  padding: '4px 12px', background: 'rgba(76, 175, 80, 0.15)', color: '#4caf50',
                  borderRadius: '20px', fontSize: '0.85rem',
                }}>
                  {genre}
                </span>
              ))}
            </div>
          )}

          {studios.length > 0 && (
            <p style={{ color: '#999', marginBottom: '15px' }}>
              <strong style={{ color: '#ccc' }}>Studio{studios.length > 1 ? 's' : ''}:</strong>{' '}
              {studios.map((studio, index) => (
                <span key={`studio-${studio.id}-${index}`}>
                  <a
                    href={`https://anilist.co/studio/${studio.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4caf50', textDecoration: 'none' }}
                  >
                    {studio.name}
                  </a>
                  {index < studios.length - 1 && ', '}
                </span>
              ))}
            </p>
          )}

          {anime.description && (
            <p
              style={{ color: '#ccc', lineHeight: '1.8' }}
              dangerouslySetInnerHTML={{
                __html: anime.description.length > 500
                  ? anime.description.slice(0, 500) + '…'
                  : anime.description,
              }}
            />
          )}
        </div>
      </div>

      {/* Related Seasons - GROUPED */}
      {relatedSeasons.length > 0 && (
        <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>
            Related Seasons ({relatedSeasons.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {relatedSeasons.map((season, index) => {
              const isCurrent = season.id === Number(id);
              return (
                <Link
                  key={`season-${season.id}-${index}`}
                  href={`/anime/${season.id}`}
                  className="season-link"
                  style={{
                    padding: '15px',
                    background: isCurrent ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: isCurrent ? '2px solid #4caf50' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: '#fff',
                    transition: 'all 0.3s',
                    position: 'relative',
                  }}
                >
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#4caf50',
                      color: '#fff',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                    }}>
                      ▶ Current
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                      {season.relationType === 'SEQUEL' ? '▶ ' : ''}
                      {season.relationType === 'PREQUEL' ? '◀ ' : ''}
                      {season.title}
                    </span>
                    {season.episodes && (
                      <span style={{ color: '#999', fontSize: '0.75rem' }}>
                        {season.episodes} eps
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {season.seasonYear && (
                      <span style={{ color: '#666', fontSize: '0.75rem' }}>{season.seasonYear}</span>
                    )}
                    {season.averageScore > 0 && (
                      <span style={{ color: '#ffd700', fontSize: '0.75rem' }}>★ {(season.averageScore / 10).toFixed(1)}</span>
                    )}
                    {season.format && season.format !== 'TV' && (
                      <span style={{ color: '#4caf50', fontSize: '0.7rem' }}>{season.format}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Related Media - MOVIES, OVAs, SPECIALS, ONA */}
      {otherRelated.length > 0 && (
        <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>
            Others ({otherRelated.length})
          </h2>
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            flexWrap: 'wrap',
            background: 'rgba(255,255,255,0.02)',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            {otherRelated.map((item, index) => (
              <Link
                key={`other-${item.id}-${index}`}
                href={`/anime/${item.id}`}
                className="related-link"
                style={{
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: '#ccc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.3s',
                }}
              >
                <span style={{ 
                  color: '#4caf50', 
                  fontSize: '0.7rem', 
                  fontWeight: '600',
                  background: 'rgba(76, 175, 80, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}>
                  {formatFormat(item.format)}
                </span>
                <span style={{ fontSize: '0.9rem' }}>{item.title}</span>
                {item.seasonYear && (
                  <span style={{ color: '#666', fontSize: '0.75rem' }}>({item.seasonYear})</span>
                )}
                <span style={{ color: '#4caf50', fontSize: '0.8rem' }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Characters */}
      {characters.length > 0 && (
        <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Characters &amp; Voice Actors</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
            {characters.slice(0, 12).map(({ node: character, role, voiceActors }, index) => (
              <div key={`character-${character.id}-${index}`} className="character-card" style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.3s',
              }}>
                <a
                  href={`https://anilist.co/character/${character.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: '#fff', display: 'block' }}
                >
                  <div style={{ aspectRatio: '2/3', background: '#1a1a1a', overflow: 'hidden' }}>
                    {character.image?.large ? (
                      <img
                        src={character.image.large}
                        alt={character.name.full}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '40px' }}>👤</div>
                    )}
                  </div>
                  <div style={{ padding: '10px' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{character.name.full}</div>
                    {role && <div style={{ color: '#999', fontSize: '0.75rem' }}>{role}</div>}
                  </div>
                </a>

                {voiceActors && voiceActors.length > 0 && (
                  <a
                    href={`https://anilist.co/staff/${voiceActors[0].id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      textDecoration: 'none',
                      color: '#999',
                      transition: 'all 0.3s',
                    }}
                  >
                    {voiceActors[0].image?.medium ? (
                      <img
                        src={voiceActors[0].image.medium}
                        alt={voiceActors[0].name.full}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🎤</div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#ccc' }}>{voiceActors[0].name.full}</div>
                      <div style={{ fontSize: '0.65rem' }}>Voice Actor</div>
                    </div>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff */}
      {staff.length > 0 && (
        <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Staff</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
            {staff.slice(0, 8).map(({ node: person, role }, index) => (
              <a
                key={`staff-${person.id}-${index}`}
                href={`https://anilist.co/staff/${person.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="staff-link"
                style={{
                  textDecoration: 'none',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.3s',
                }}
              >
                <div style={{ width: '80px', height: '80px', margin: '0 auto', borderRadius: '50%', overflow: 'hidden', background: '#1a1a1a' }}>
                  {person.image?.medium ? (
                    <img
                      src={person.image.medium}
                      alt={person.name.full}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '30px' }}>👤</div>
                  )}
                </div>
                <div style={{ fontWeight: '600', fontSize: '0.85rem', marginTop: '8px' }}>{person.name.full}</div>
                {role && <div style={{ color: '#999', fontSize: '0.75rem' }}>{role}</div>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div style={{ 
          maxWidth: '1100px', 
          margin: '40px auto 60px', 
          padding: '30px 20px',
          background: 'linear-gradient(180deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.02) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(76, 175, 80, 0.1)',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: '25px',
          }}>
            <span style={{ fontSize: '28px' }}>✨</span>
            <h2 style={{ 
              color: '#4caf50', 
              margin: 0,
              fontSize: '1.8rem',
              fontWeight: '700',
              letterSpacing: '-0.5px',
            }}>
              Recommendations
            </h2>
            <span style={{ 
              color: '#666', 
              fontSize: '0.9rem',
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.05)',
              padding: '4px 12px',
              borderRadius: '20px',
            }}>
              {recommendations.length} titles
            </span>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
            gap: '20px',
          }}>
            {recommendations.slice(0, 12).map(({ mediaRecommendation }, index) => (
              <Link
                key={`reco-${mediaRecommendation.id}-${index}`}
                href={`/anime/${mediaRecommendation.id}`}
                className="recommendation-card"
                style={{
                  textDecoration: 'none',
                  color: '#fff',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  display: 'block',
                }}
              >
                <div style={{ 
                  position: 'relative',
                  aspectRatio: '2/3', 
                  background: '#1a1a1a',
                  overflow: 'hidden',
                }}>
                  {mediaRecommendation.coverImage?.large ? (
                    <img
                      src={mediaRecommendation.coverImage.large}
                      alt={mediaRecommendation.title?.english || mediaRecommendation.title?.romaji || 'Unknown'}
                      className="recommendation-image"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%', 
                      fontSize: '40px',
                      color: '#666',
                    }}>🎌</div>
                  )}
                  
                  {mediaRecommendation.averageScore > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.8)',
                      backdropFilter: 'blur(8px)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      color: '#ffd700',
                      border: '1px solid rgba(255, 215, 0, 0.2)',
                    }}>
                      ★ {(mediaRecommendation.averageScore / 10).toFixed(1)}
                    </div>
                  )}
                  
                  {mediaRecommendation.format && (
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      background: 'rgba(0,0,0,0.8)',
                      backdropFilter: 'blur(8px)',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      color: '#4caf50',
                      border: '1px solid rgba(76, 175, 80, 0.2)',
                    }}>
                      {mediaRecommendation.format}
                    </div>
                  )}
                </div>
                
                <div style={{ padding: '12px' }}>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.9rem',
                    marginBottom: '4px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '1.3',
                  }}>
                    {mediaRecommendation.title?.english || mediaRecommendation.title?.romaji || 'Unknown'}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center',
                    color: '#666',
                    fontSize: '0.75rem',
                  }}>
                    {mediaRecommendation.seasonYear && (
                      <span>{mediaRecommendation.seasonYear}</span>
                    )}
                    {mediaRecommendation.episodes && (
                      <>
                        <span style={{ color: '#444' }}>•</span>
                        <span>{mediaRecommendation.episodes} eps</span>
                      </>
                    )}
                  </div>
                  {mediaRecommendation.status && (
                    <div style={{
                      marginTop: '6px',
                      fontSize: '0.65rem',
                      color: mediaRecommendation.status === 'RELEASING' ? '#4caf50' : '#666',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {mediaRecommendation.status}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}