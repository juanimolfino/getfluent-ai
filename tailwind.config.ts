import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./emails/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        // GetFluent editorial design system (marketing landing)
        gf: {
          paper: "var(--gf-paper)",
          "paper-2": "var(--gf-paper-2)",
          "paper-3": "var(--gf-paper-3)",
          card: "var(--gf-card)",
          ink: "var(--gf-ink)",
          "ink-2": "var(--gf-ink-2)",
          "ink-3": "var(--gf-ink-3)",
          line: "var(--gf-line)",
          "line-2": "var(--gf-line-2)",
          lilac: "var(--gf-lilac)",
          peach: "var(--gf-peach)",
          sky: "var(--gf-sky)",
          mint: "var(--gf-mint)",
          butter: "var(--gf-butter)",
          "lilac-ink": "var(--gf-lilac-ink)",
          "peach-ink": "var(--gf-peach-ink)",
          "sky-ink": "var(--gf-sky-ink)",
          "mint-ink": "var(--gf-mint-ink)"
        }
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        hanken: ["var(--font-hanken)", "system-ui", "sans-serif"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // GetFluent radii
        "gf-sm": "12px",
        "gf-base": "18px",
        "gf-lg": "28px",
        pill: "100px"
      },
      boxShadow: {
        "gf-sm": "0 1px 2px rgba(33,30,26,.04), 0 1px 1px rgba(33,30,26,.03)",
        gf: "0 12px 30px -12px rgba(33,30,26,.14), 0 2px 6px rgba(33,30,26,.05)",
        "gf-lg":
          "0 40px 80px -32px rgba(33,30,26,.28), 0 8px 24px -12px rgba(33,30,26,.12)"
      },
      transitionTimingFunction: {
        gf: "cubic-bezier(.22,.61,.36,1)"
      }
    }
  },
  plugins: []
};

export default config;
