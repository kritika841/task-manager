import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Manager — Daily Targets & Deliverables",
  description: "Team task management and daily target tracker connected with Ads Management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('satmi-theme')||'midnight';if(t==='obsidian'){t='midnight';localStorage.setItem('satmi-theme','midnight');}if(t==='light'){document.documentElement.classList.remove('dark','theme-midnight');document.documentElement.dataset.theme='light';}else{document.documentElement.classList.add('dark','theme-midnight');document.documentElement.dataset.theme='midnight';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
