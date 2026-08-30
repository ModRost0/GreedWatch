// src/app/show/[id]/page.jsx
import Link from "next/link";
import Header from "@/components/Header";
import { getMediaDetails } from "@/lib/api";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function ShowPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const type = query?.type || 'movie';
  
  console.log('=== SHOW PAGE ===');
  console.log('ID:', id);
  console.log('Type:', type);
  
  const media = await getMediaDetails(id, type);
  
  console.log('Media result:', media ? 'FOUND' : 'NOT FOUND');
  
  if (!media) {
    return (
      <main className="siteShell">
        <Header />
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '64px' }}>🎬</span>
          <h1>Loading...</h1>
          <p>If this persists, the content might not be available.</p>
          <Link href="/search" className="button buttonPrimary">← Back to Search</Link>
        </div>
      </main>
    );
  }
  
  const poster = media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null;
  const displayTitle = media.title || media.name || 'Unknown';
  const date = media.release_date || media.first_air_date || '';
  
  return (
    <main className="siteShell">
      <Header />
      
      <div style={{
        maxWidth: '1100px',
        margin: '40px auto',
        padding: '0 20px',
        display: 'grid',
        gridTemplateColumns: '250px 1fr',
        gap: '40px',
      }}>
        <div>
          {poster ? (
            <img src={poster} alt={displayTitle} style={{ width: '100%', borderRadius: '12px' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2/3', background: '#1a1a1a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🎬</div>
          )}
        </div>
        
        <div>
          <p style={{ color: '#4caf50', fontWeight: '600', letterSpacing: '3px' }}>
            {type === 'tv' ? 'TV SERIES' : 'MOVIE'}
          </p>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0' }}>{displayTitle}</h1>
          
          <div style={{ display: 'flex', gap: '15px', color: '#999', marginBottom: '15px' }}>
            <span>{date.slice(0, 4) || 'N/A'}</span>
            {media.vote_average > 0 && <span style={{ color: '#ffd700' }}>★ {media.vote_average.toFixed(1)}</span>}
          </div>
          
          {media.overview && <p style={{ color: '#ccc', lineHeight: '1.8', marginBottom: '25px' }}>{media.overview}</p>}
          
          <Link 
            href={`/embed/${type}/${id}`}
            style={{
              display: 'inline-block',
              padding: '15px 30px',
              background: '#4caf50',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '25px',
              fontSize: '1.1rem',
              fontWeight: '600',
            }}
          >
            ▶ Watch Now
          </Link>
        </div>
      </div>
    </main>
  );
}