"use client";

import { ThemeProvider } from "@/app/components/ThemeProvider";

export default function ThemeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}