import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wyrt CTF - Capture the Flag",
  description: "A fast-paced multiplayer capture the flag game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
