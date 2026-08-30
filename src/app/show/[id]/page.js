// src/app/show/[id]/page.jsx - Full show page with cast and companies
import Link from 'next/link';
import Header from '@/components/Header';
import { getMediaDetails } from '@/lib/api';

export const revalidate = 3600;

const TMDB_TOKEN = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
const TMDB_BASE = 'https://api.themoviedb.org/3';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

export default async function ShowPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const type = query?.type || 'movie';
  
  // Fetch media details with credits and companies
  let media = null;
  let cast = [];
  let companies = [];
  let recommendations = [];
  
  try {
    const response = await fetch(
      `${TMDB_BASE}/${type}/${id}?language=en-US&append_to_response=credits,recommendations`,
      {
        headers: {
          'Authorization': `Bearer ${TMDB_TOKEN}`,
          'accept': 'application/json',
        },
        next: { revalidate: 3600 },
      }
    );
    
    if (response.ok) {
      media = await response.json();
      cast = media.credits?.cast?.slice(0, 12) || [];
      companies = media.production_companies || [];
      recommendations = media.recommendations?.results?.slice(0, 6) || [];
    }
  } catch (error) {
    media = null;
  }
  
  if (!media) {
    return (
      <main className="siteShell">
        <Header />
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '64px' }}>🎬</span>
          <h1>Not Found</h1>
          <Link href="/search" className="button buttonPrimary">← Back to Search</Link>
        </div>
      </main>
    );
  }
  
  const poster = media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null;
  const backdrop = media.backdrop_path ? `https://image.tmdb.org/t/p/w1280${media.backdrop_path}` : null;
  const displayTitle = media.title || media.name || 'Unknown';
  const date = media.release_date || media.first_air_date || '';
  const imdbId = media.imdb_id || '';
  
  const embedData = encodeURIComponent(JSON.stringify({
    title: displayTitle,
    overview: media.overview,
    year: date.slice(0, 4),
    rating: media.vote_average,
    poster: poster,
    genres: media.genres?.map(g => g.name).join(', '),
  }));

  return (
    <main className="siteShell">
      <Header />
      
      {/* Backdrop Banner */}
      {isValidUrl(backdrop) && (
        <div style={{
          height: '300px',
          backgroundImage: `url(${backdrop})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(180deg, transparent 0%, #0a0a0a 100%)',
          }} />
        </div>
      )}

      <div style={{
        maxWidth: '1100px',
        margin: backdrop ? '-50px auto 40px' : '40px auto',
        padding: '0 20px',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '30px',
        position: 'relative',
      }}>
        {/* Poster */}
        <div>
          {isValidUrl(poster) ? (
            <img src={poster} alt={displayTitle} style={{ width: '100%', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2/3', background: '#1a1a1a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🎬</div>
          )}
          
          <Link href={`/embed/${type}/${media.id}?data=${embedData}`} style={{
            display: 'block', textAlign: 'center', marginTop: '15px', padding: '12px',
            background: '#4caf50', color: '#fff', textDecoration: 'none', borderRadius: '25px', fontWeight: '600',
          }}>
            ▶ Watch Now
          </Link>
          
          {/* External Links */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {imdbId && (
              <a href={`https://www.imdb.com/title/${imdbId}`} target="_blank" rel="noopener noreferrer" style={{
                padding: '6px 12px', background: 'rgba(245, 197, 24, 0.2)', color: '#f5c518',
                textDecoration: 'none', borderRadius: '5px', fontSize: '0.8rem',
              }}>
                IMDb
              </a>
            )}
            <a href={`https://www.themoviedb.org/${type}/${media.id}`} target="_blank" rel="noopener noreferrer" style={{
              padding: '6px 12px', background: 'rgba(1, 180, 228, 0.2)', color: '#01b4e4',
              textDecoration: 'none', borderRadius: '5px', fontSize: '0.8rem',
            }}>
              TMDB
            </a>
          </div>
        </div>

        {/* Info */}
        <div>
          <p style={{ color: '#4caf50', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '3px', textTransform: 'uppercase' }}>
            {type === 'tv' ? 'TV SERIES' : 'MOVIE'}
          </p>
          <h1 style={{ fontSize: '2.2rem', margin: '10px 0 5px' }}>{displayTitle}</h1>
          
          {media.tagline && <p style={{ color: '#999', fontStyle: 'italic', margin: '0 0 10px' }}>{media.tagline}</p>}
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px', color: '#999' }}>
            {date && <span>{date.slice(0, 4)}</span>}
            {media.vote_average > 0 && <span style={{ color: '#ffd700', fontWeight: '600' }}>★ {media.vote_average.toFixed(1)}</span>}
            {media.runtime && <span>{media.runtime} min</span>}
            {media.episode_run_time && <span>{media.episode_run_time[0]} min/ep</span>}
            {media.number_of_seasons && <span>{media.number_of_seasons} seasons</span>}
          </div>
          
          {media.genres && media.genres.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
              {media.genres.map(genre => (
                <span key={genre.id} style={{
                  padding: '4px 12px', background: 'rgba(76, 175, 80, 0.15)', color: '#4caf50',
                  borderRadius: '20px', fontSize: '0.85rem',
                }}>
                  {genre.name}
                </span>
              ))}
            </div>
          )}
          
          {media.overview && (
            <p style={{ color: '#ccc', lineHeight: '1.8', marginBottom: '20px' }}>{media.overview}</p>
          )}
        </div>
      </div>

      {/* Cast Section */}
      {cast.length > 0 && (
        <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Top Cast</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
            {cast.map(actor => (
              <a
                key={actor.id}
                href={`https://www.themoviedb.org/person/${actor.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: '#fff', textAlign: 'center' }}
              >
                <div style={{ borderRadius: '8px', overflow: 'hidden', aspectRatio: '2/3', background: '#1a1a1a' }}>
                  {actor.profile_path ? (
                    <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '40px' }}>👤</div>
                  )}
                </div>
                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {actor.name}
                </span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {actor.character || actor.roles?.[0]?.character}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Production Companies */}
      {companies.length > 0 && (
        <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Production Companies</h2>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            {companies.map(company => (
              <a
                key={company.id}
                href={`https://www.themoviedb.org/company/${company.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px',
                  background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px',
                  textDecoration: 'none', color: '#ccc', transition: 'all 0.3s',
                }}
              >
                {company.logo_path ? (
                  <img src={`https://image.tmdb.org/t/p/w200${company.logo_path}`} alt={company.name} style={{ maxWidth: '60px', maxHeight: '30px', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '0.85rem' }}>{company.name}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Similar Titles</h2>
          <div className="catalogGrid">
            {recommendations.map(item => (
              <Link key={item.id} href={`/show/${item.id}?type=${item.media_type || 'movie'}`} className="catalogItem">
                <div className="catalogPoster">
                  {item.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.title || item.name} loading="lazy" />
                  ) : (
                    <div className="noPoster">🎬</div>
                  )}
                  <span className="cardScore">★ {item.vote_average?.toFixed(1) || "—"}</span>
                </div>
                <h3>{item.title || item.name}</h3>
                <p>{(item.release_date || item.first_air_date || '').slice(0, 4)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}