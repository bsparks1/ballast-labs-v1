import { AuthProvider } from "@/components/auth/AuthProvider";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ballast — Agent Harness Audit",
  description:
    "Audit the harness of your AI agent: instructions, tools, memory, guardrails, and delegation rules. Track versions over time.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider key={user?.id ?? "anon"} initialUser={user}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
