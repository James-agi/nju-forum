import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Providers } from "@/components/providers";
import { BackToTop } from "@/components/ui/back-to-top";
import { CommandTrigger } from "@/components/ui/command-trigger";
import { CommandPalette } from "@/components/ui/command-palette";

export const metadata: Metadata = {
  title: "知南 - NJU Know",
  description: "南京大学校园知识社区",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var r=document.documentElement;if(t==='dark'){r.classList.add('dark');}else if(t==='light'){r.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <BackToTop />
          <CommandTrigger />
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
