import './globals.css';
import Navbar from '../components/Navbar'; // Importujemy nasz nowy pasek!

export const metadata = {
  title: 'Giełda Terrarystyczna',
  description: 'MVP platformy do handlu zwierzętami egzotycznymi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      {/* Dodaliśmy delikatne szare tło do całej aplikacji, żeby białe karty ogłoszeń lepiej wyglądały */}
      <body className="bg-white-50 min-h-screen">
        
        {/* Nasz globalny pasek nawigacyjny! */}
        <Navbar />
        
        {/* Tutaj Next.js dynamicznie wrzuca zawartość konkretnych stron (page.tsx) */}
        {children}
        
      </body>
    </html>
  );
}