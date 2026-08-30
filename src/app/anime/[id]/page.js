// src/app/anime/[id]/page.jsx - Full with dub info, eps above info
import Link from 'next/link';
import Header from '@/components/Header';

export const revalidate = 3600;

const ANILIST_API = 'https://graphql.anilist.co';

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('http');
}

async function checkDubAvailability(animeId) {
  try {
    const response = await fetch(`https://anixo.buzz/embed/ani/${animeId}/1/dub`, {
      method: 'HEAD',
      headers: { 'Accept': 'text/html' },
    });
    return response.status !== 404;
  } catch (error) {
    return true;
  }
}

async function getDubEpisodeCount(animeId) {
  try {
    let dubCount = 0;
    const checkPoints = [1, 2, 4, 8, 16, 32, 64, 128];
    
    for (const ep of checkPoints) {
      const response = await fetch(`https://anixo.buzz/embed/ani/${animeId}/${ep}/dub`, {
        method: 'HEAD',
      });
      if (response.status !== 404) {
        dubCount = ep;
      } else {
        break;
      }
    }
    
    if (dubCount > 0) {
      let low = dubCount;
      let high = dubCount * 2;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const response = await fetch(`https://anixo.buzz/embed/ani/${animeId}/${mid}/dub`, {
          method: 'HEAD',
        });
        
        if (response.status !== 404) {
          dubCount = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
    }
    
    return dubCount;
  } catch (error) {
    return 0;
  }
}

async function getAnimeData(animeId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
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
        studios { nodes { name } }
        nextAiringEpisode { episode airingAt timeUntilAiring }
        airingSchedule { nodes { episode airingAt } }
      }
    }
  `;

  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { id: Number(animeId) } }),
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.data?.Media || null;
  } catch (error) {
    return null;
  }
}

function getAiredEpisodes(media) {
  if (!media) return [];
  
  const now = Math.floor(Date.now() / 1000);
  const airedSchedule = media.airingSchedule?.nodes || [];
  
  if (media.status === 'FINISHED' && media.episodes) {
    return Array.from({ length: media.episodes }, (_, i) => ({
      number: i + 1,
      aired: true,
    }));
  }
  
  if (airedSchedule.length > 0) {
    return airedSchedule
      .filter(node => node.airingAt && node.airingAt <= now)
      .map(node => ({
        number: node.episode,
        aired: true,
        airingAt: node.airingAt,
      }))
      .sort((a, b) => a.number - b.number);
  }
  
  if (media.nextAiringEpisode?.episode) {
    const totalAired = media.nextAiringEpisode.episode - 1;
    return Array.from({ length: Math.max(totalAired, 1) }, (_, i) => ({
      number: i + 1,
      aired: true,
    }));
  }
  
  return [{ number: 1, aired: true }];
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

export default async function AnimeDetailPage({ params }) {
  const { id } = await params;
  
  const anime = await getAnimeData(id);
  
  if (!anime) {
    return (
      <main className="siteShell">
        <Header />
        <div className="animeNotFound">
          <span className="animeNotFoundIcon">🎌</span>
          <h1 className="animeNotFoundTitle">Anime Not Found</h1>
          <Link href="/anime" className="button buttonPrimary">← Back to Anime</Link>
        </div>
      </main>
    );
  }

  const episodes = getAiredEpisodes(anime);
  const title = anime.title?.english || anime.title?.romaji || anime.title?.native || 'Unknown';
  const image = anime.coverImage?.extraLarge || anime.coverImage?.large || null;
  const hasBanner = isValidUrl(anime.bannerImage);
  
  const [dubAvailable, dubCount] = await Promise.all([
    checkDubAvailability(id),
    getDubEpisodeCount(id),
  ]);

  return (
    <main className="siteShell">
      <Header />
      
      {hasBanner && (
        <div className="animeDetailBanner" style={{ backgroundImage: `url(${anime.bannerImage})` }}>
          <div className="animeDetailBannerOverlay" />
        </div>
      )}

      <div className={hasBanner ? 'animeDetailContainer' : 'animeDetailContainerNoBanner'}>
        {/* Poster and Watch Button */}
        <div>
          {isValidUrl(image) ? (
            <img src={image} alt={title} className="animeDetailPoster" />
          ) : (
            <div className="animeDetailNoPoster">🎌</div>
          )}

          {episodes.length > 0 && (
            <Link href={`/anime/watch/${id}/1`} className="animeWatchButton">
              ▶ Watch Now
            </Link>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="animeDetailEyebrow">ANIME</p>
          <h1 className="animeDetailTitle">{title}</h1>
          
          {anime.title?.native && anime.title.native !== title && (
            <p className="animeDetailNativeTitle">{anime.title.native}</p>
          )}

          <div className="animeDetailMeta">
            {anime.averageScore > 0 && (
              <span className="animeDetailScore">★ {(anime.averageScore / 10).toFixed(1)}</span>
            )}
            {anime.seasonYear && <span>{anime.seasonYear}</span>}
            {anime.episodes && <span className="animeDetailEpisodes">{anime.episodes} eps</span>}
            {anime.status && <span className="animeDetailStatus">{anime.status}</span>}
            {anime.format && <span className="animeDetailFormat">{anime.format}</span>}
            {anime.duration && <span className="animeDetailDuration">{anime.duration} min</span>}
          </div>

          {/* Audio Info */}
          <div className="animeAudioInfo">
            <span className="audioBadge subBadge">🟢 Subbed</span>
            {dubAvailable ? (
              <span className="audioBadge dubBadge">
                🟢 Dubbed {dubCount > 0 && `(${dubCount} eps)`}
              </span>
            ) : (
              <span className="audioBadge dubUnavailable">🔴 No Dub</span>
            )}
          </div>

          {anime.nextAiringEpisode && anime.nextAiringEpisode.airingAt > Math.floor(Date.now() / 1000) && (
            <div className="animeNextEpisode">
              <span className="animeNextEpisodeLabel">
                Next: Ep {anime.nextAiringEpisode.episode}
              </span>
              {anime.nextAiringEpisode.timeUntilAiring > 0 && (
                <span className="animeNextEpisodeTime">
                  in {formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}
                </span>
              )}
            </div>
          )}

          {anime.genres && anime.genres.length > 0 && (
            <div className="animeGenres">
              {anime.genres.map((genre, index) => (
                <span key={index} className="animeGenreTag">{genre}</span>
              ))}
            </div>
          )}

          {anime.studios?.nodes?.length > 0 && (
            <p className="animeStudios">
              <span className="animeStudiosLabel">Studios:</span>{' '}
              {anime.studios.nodes.map(s => s.name).join(', ')}
            </p>
          )}

          {anime.description && (
            <p className="animeSynopsis">
              {anime.description.length > 500 ? anime.description.slice(0, 500) + '...' : anime.description}
            </p>
          )}
        </div>
      </div>

      {/* Episodes Section - BELOW info but ABOVE comments */}
      {episodes.length > 0 && (
        <div className="animeEpisodesSection">
          <h2 className="animeEpisodesTitle">Episodes ({episodes.length} aired)</h2>
          <div className="animeEpisodesGrid">
            {episodes.map(ep => (
              <Link
                key={ep.number}
                href={`/anime/watch/${id}/${ep.number}`}
                className="animeEpisodeLink"
              >
                EP {ep.number}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}