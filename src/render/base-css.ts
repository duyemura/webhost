export const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-body);
  color: var(--color-fg);
  background: var(--color-bg);
  line-height: 1.6;
  font-size: 16px;
}

img, video { max-width: 100%; display: block; }

a { color: inherit; }

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

@media (max-width: 768px) {
  .container { padding: 0 1rem; }
}

section { padding: var(--section-padding); }

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  letter-spacing: var(--heading-tracking);
  text-transform: var(--heading-transform);
  line-height: 1.2;
  color: inherit;
}

h1 { font-size: var(--h1-size); }
h2 { font-size: var(--h2-size); }
h3 { font-size: var(--h3-size); }
h4 { font-size: 1.25rem; }

p { max-width: 70ch; }

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-primary);
  color: var(--color-primary-fg);
  padding: 0.75rem 1.75rem;
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.88; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--color-primary);
  padding: 0.75rem 1.75rem;
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  border: 2px solid var(--color-primary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-secondary:hover { background: var(--color-primary); color: var(--color-primary-fg); }

.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }

@media (max-width: 900px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
}

.text-center { text-align: center; }
.text-center p { margin: 0 auto; }

.section-label {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
}
.section-label::before {
  content: '';
  display: inline-block;
  width: 1.5rem;
  height: 2px;
  background: var(--color-primary);
  flex-shrink: 0;
}

.section-header {
  margin-bottom: 3rem;
}
.section-header h2 {
  margin-bottom: 1rem;
}
.section-header p {
  color: var(--color-muted-fg);
  font-size: 1.125rem;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 2rem;
}

.badge {
  display: inline-block;
  background: var(--color-muted);
  color: var(--color-muted-fg);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
`;
