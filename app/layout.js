import "./globals.css";
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata = {
  title: "LumiByte - DSA Revision Portal",
  description: "Created by Devs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <Breadcrumbs />
        {children}
      </body>
    </html>
  );
}
