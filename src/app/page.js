import Link from "next/link";

const picks = [
  { title: "The Bear", meta: "Drama · 3 seasons", score: "9.1", color: "#b85838", mark: "BEAR" },
  { title: "Severance", meta: "Mystery · 2 seasons", score: "8.7", color: "#a8b5a1", mark: "SEVER" },
  { title: "Arcane", meta: "Animation · 2 seasons", score: "9.0", color: "#7361a9", mark: "ARCANE" },
  { title: "The Last of Us", meta: "Drama · 2 seasons", score: "8.6", color: "#6e855a", mark: "TLOU" },
];

function Poster({ item }) {
  return <div className="poster" style={{ "--poster": item.color }}><span>{item.mark}</span><i>{item.score}</i></div>;
}

export default function Home() {
  return (
    <main className="siteShell">
      <header className="nav"><Link className="wordmark" href="/">reel<span>room</span></Link><nav><Link href="/discover">Discover</Link><Link href="/popular">Popular</Link><Link href="/upcoming">Upcoming</Link></nav><Link className="navSearch" href="/search">⌕ <span>Search</span></Link></header>
      <section className="hero"><div className="heroCopy"><p className="eyebrow">THE EDITOR&apos;S CUT / 01</p><h1>Find something<br /><em>worth watching.</em></h1><p className="heroText">A thoughtful place for the shows you love, the stories you missed, and the next obsession waiting around the corner.</p><Link className="button buttonLight" href="/discover">Explore the room <span>↗</span></Link></div><div className="heroArtwork"><div className="sun"></div><div className="heroLabel">THE<br />OTHER<br /><b>WORLD</b></div><div className="heroCaption">01 / 04<br /><span>THE LAST OF US</span></div></div></section>
      <section className="section"><div className="sectionHead"><div><p className="eyebrow">A LITTLE INSPIRATION</p><h2>Picked for you</h2></div><Link className="textLink" href="/discover">See all <span>↗</span></Link></div><div className="posterGrid">{picks.map((item) => <Link href={`/show/${encodeURIComponent(item.title)}`} className="pick" key={item.title}><Poster item={item} /><h3>{item.title}</h3><p>{item.meta}</p></Link>)}</div></section>
      <footer><span>reelroom / 2026</span><span>Good stories, better company.</span></footer>
    </div>
  );
}
