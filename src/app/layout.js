// src/app/layout.jsx
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Greed - Stream Movies & TV',
  description: 'Free streaming platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}