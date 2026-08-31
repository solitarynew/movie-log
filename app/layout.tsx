import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '观影记录 · Personal Screening Room',
  description: '一个只属于自己的观影时间线，记录看过的与计划看的电影。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
