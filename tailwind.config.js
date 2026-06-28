/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      // Standard responsive max-widths. The mobile-first customer/vendor/
      // rider/anchor portals constrain themselves with the custom
      // `.page-container` utility (max-w-lg), so the global container is
      // free to behave normally for wide admin/desktop layouts.
    },
    extend: {
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // SETU brand tokens
        setu: {
          saffron: 'hsl(var(--setu-saffron))',
          teal:    'hsl(var(--setu-teal))',
          earth:   'hsl(var(--setu-earth))',
          success: 'hsl(var(--setu-success))',
          warning: 'hsl(var(--setu-warning))',
        },
        // Admin/Super-Admin sidebar chrome
        sidebar: {
          DEFAULT:    'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border:     'hsl(var(--sidebar-border))',
          accent:     'hsl(var(--sidebar-accent))',
          primary:    'hsl(var(--sidebar-primary))',
        },
      },
      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
        xl:   'calc(var(--radius) + 4px)',
        '2xl':'calc(var(--radius) + 8px)',
      },
      fontFamily: {
        sans:    ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'system-ui', 'sans-serif'],
        heading: ["'Segoe UI'", 'system-ui', 'sans-serif'],
        mono:    ["'SF Mono'", "'Fira Code'", 'monospace'],
      },
      boxShadow: {
        'sm':    '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'DEFAULT': '0 2px 4px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'md':    '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'card':  '0 2px 8px 0 rgb(0 0 0 / 0.08)',
        'float': '0 8px 24px 0 rgb(0 0 0 / 0.12)',
      },
      screens: {
        'xs':   '375px',
        'sm':   '640px',
        'md':   '768px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
