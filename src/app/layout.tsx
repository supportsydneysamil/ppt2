import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "교회 프레젠테이션 - Church Presentation",
  description: "웹에서 예배용 프레젠테이션을 제작하고 듀얼 스크린으로 송출하세요.",
  keywords: ["교회", "프레젠테이션", "예배", "찬양", "성경", "PPT"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
