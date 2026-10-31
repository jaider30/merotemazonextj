import type { Metadata } from "next";
// import "./globals.css";

export const metadata: Metadata = {
  title: "Merotemazo",
  description: "Páginas web para discotecas y negocios, con peticiones musicales en vivo. ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}