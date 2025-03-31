import "./globals.css";

export const metadata = {
  title: "LumiByte - DSA Revision Portal",
  description: "Created by Devs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
