"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";
const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Theo máy", icon: Monitor },
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
];

/** Chọn giao diện: theo máy / sáng / tối. Lưu trong trình duyệt. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wh_theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc lựa chọn đã lưu sau khi hydrate
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* localStorage bị chặn: dùng theo máy */
    }
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("wh_theme");
      else localStorage.setItem("wh_theme", t);
    } catch {
      /* bỏ qua */
    }
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <div role="radiogroup" aria-label="Giao diện" className="flex rounded-xl bg-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors",
            theme === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon size={14} />
          {value === "system" ? "Tự động" : label}
        </button>
      ))}
    </div>
  );
}
