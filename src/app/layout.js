import "./globals.css";

export const metadata = {
  title: "Reelroom | Find your next favorite",
  description: "A carefully curated TV and movie discovery room.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
