import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@pushpress/pushpress-ui/dist/**/*.{js,jsx}",
  ],
  prefix: "tw-",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
          medium: "hsl(var(--primary-medium))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        neutral: {
          "100": "hsl(var(--neutral-100))",
          "200": "hsl(var(--neutral-200))",
          "300": "hsl(var(--neutral-300))",
          "400": "hsl(var(--neutral-400))",
          "500": "hsl(var(--neutral-500))",
          "600": "hsl(var(--neutral-600))",
          "700": "hsl(var(--neutral-700))",
          "800": "hsl(var(--neutral-800))",
          "900": "hsl(var(--neutral-900))",
        },
        info: {
          light: "hsl(var(--info-light))",
          DEFAULT: "hsl(var(--info))",
          medium: "hsl(var(--info-medium))",
          dark: "hsl(var(--info-dark))",
        },
        success: {
          light: "hsl(var(--success-light))",
          DEFAULT: "hsl(var(--success))",
          medium: "hsl(var(--success-medium))",
          dark: "hsl(var(--success-dark))",
        },
        warning: {
          light: "hsl(var(--warning-light))",
          DEFAULT: "hsl(var(--warning))",
          medium: "hsl(var(--warning-medium))",
          dark: "hsl(var(--warning-dark))",
        },
        error: {
          light: "hsl(var(--error-light))",
          DEFAULT: "hsl(var(--error))",
          medium: "hsl(var(--error-medium))",
          dark: "hsl(var(--error-dark))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0", opacity: "0" },
          to: {
            height: "var(--radix-collapsible-content-height)",
            opacity: "1",
          },
        },
        "collapsible-up": {
          from: {
            height: "var(--radix-collapsible-content-height)",
            opacity: "1",
          },
          to: { height: "0", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.3s ease-out",
        "collapsible-up": "collapsible-up 0.3s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
