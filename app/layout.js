import "./globals.css";

export const metadata = {
  title: "BytePrep - DSA Revision Portal",
  description: "Created by Devs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
