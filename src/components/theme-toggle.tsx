import { useTheme } from "next-themes";
import * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [, startTransition] = React.useTransition();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Only run this effect when `theme` or `resolvedTheme` changes
    useEffect(() => {
        if (!resolvedTheme) return;
        document.documentElement.setAttribute("data-theme", resolvedTheme);
    }, [resolvedTheme]);

    if (!mounted) return null; // Don't render the switch server-side

    const isDarkMode = theme === "dark" || resolvedTheme === "dark";

    const handleToggleTheme = () => {
        setTheme(isDarkMode ? "light" : "dark");
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => {
                startTransition(() => {
                    handleToggleTheme();
                });
            }}
        >
            {!theme || theme === "dark" ? (
                <Moon className="transition-all size-5" />
            ) : (
                <Sun className="transition-all size-5" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
