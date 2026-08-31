import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetCues Assistant",
  description:
    "Role-aware question answering over AssetCues product documentation.",
  icons: { icon: "/brand/assetcues-mark.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
