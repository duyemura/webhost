export const BLOCK_CSS = `
/* ── nav ── */
.site-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}
.site-nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 4rem;
}
.site-nav__logo {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: 1.25rem;
  text-decoration: none;
  color: var(--color-fg);
}
.site-nav__links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  list-style: none;
}
.site-nav__links a {
  text-decoration: none;
  color: var(--color-fg);
  font-size: 0.9375rem;
  transition: color 0.15s;
}
.site-nav__links a:hover { color: var(--color-primary); }
.site-nav__cta { margin-left: 1rem; }
@media (max-width: 768px) {
  .site-nav__links { display: none; }
}

/* ── footer ── */
.site-footer {
  background: var(--color-muted);
  border-top: 1px solid var(--color-border);
  padding: 3rem 0 2rem;
}
.site-footer__inner {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.site-footer__name {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: 1.125rem;
}
.site-footer__meta {
  color: var(--color-muted-fg);
  font-size: 0.875rem;
  line-height: 1.8;
}
.site-footer__meta a { color: var(--color-muted-fg); }
.site-footer__copy {
  color: var(--color-muted-fg);
  font-size: 0.8125rem;
  border-top: 1px solid var(--color-border);
  padding-top: 1.5rem;
  margin-top: 0.5rem;
}

/* ── hero ── */
.block-hero {
  padding: var(--section-padding);
  background: var(--color-muted);
  min-height: 60vh;
  display: flex;
  align-items: center;
}
.block-hero--dark {
  background: var(--color-primary);
  color: var(--color-primary-fg);
}
.block-hero--image {
  background-size: cover;
  background-position: center;
  position: relative;
}
.block-hero--image::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}
.block-hero--image .container { position: relative; z-index: 1; color: #fff; }
.block-hero__content { max-width: 680px; }
.block-hero__sub {
  font-size: 1.25rem;
  color: var(--color-muted-fg);
  margin: 1.25rem 0 2rem;
}
.block-hero--dark .block-hero__sub,
.block-hero--image .block-hero__sub { color: rgba(255,255,255,0.8); }
.block-hero__actions { display: flex; gap: 1rem; flex-wrap: wrap; }

/* ── features ── */
.block-features { background: var(--color-bg); }
.block-features__item { display: flex; flex-direction: column; gap: 0.75rem; }
.block-features__icon {
  width: 3rem;
  height: 3rem;
  background: var(--color-primary);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary-fg);
  font-size: 1.5rem;
}
.block-features__item h3 { font-size: 1.125rem; }
.block-features__item p { color: var(--color-muted-fg); font-size: 0.9375rem; }

/* ── about ── */
.block-about { background: var(--color-muted); }
.block-about__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}
.block-about__image {
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--color-border);
  aspect-ratio: 4/3;
}
.block-about__image img { width: 100%; height: 100%; object-fit: cover; }
.block-about__text h2 { margin-bottom: 1rem; }
.block-about__text p { color: var(--color-muted-fg); margin-bottom: 1.5rem; }
@media (max-width: 768px) {
  .block-about__inner { grid-template-columns: 1fr; }
}

/* ── programs ── */
.block-programs { background: var(--color-bg); }
.block-programs__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.block-programs__card-body { padding: 1.5rem; flex: 1; display: flex; flex-direction: column; }
.block-programs__card h3 { margin-bottom: 0.5rem; }
.block-programs__card p { color: var(--color-muted-fg); font-size: 0.9375rem; flex: 1; }
.block-programs__card .btn-primary { margin-top: 1.5rem; align-self: flex-start; }
.block-programs__tag {
  display: inline-block;
  background: var(--color-primary);
  color: var(--color-primary-fg);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  margin-bottom: 0.75rem;
}

/* ── pricing ── */
.block-pricing { background: var(--color-muted); }
.block-pricing__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 2rem;
  display: flex;
  flex-direction: column;
}
.block-pricing__card--featured {
  border-color: var(--color-primary);
  border-width: 2px;
  position: relative;
}
.block-pricing__badge {
  position: absolute;
  top: -0.875rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary);
  color: var(--color-primary-fg);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 1rem;
  border-radius: 999px;
  white-space: nowrap;
}
.block-pricing__name { font-size: 1.125rem; font-weight: 700; margin-bottom: 0.25rem; }
.block-pricing__desc { color: var(--color-muted-fg); font-size: 0.9rem; margin-bottom: 1.25rem; }
.block-pricing__price { font-size: 2.25rem; font-weight: 800; color: var(--color-primary); margin-bottom: 0.25rem; }
.block-pricing__period { color: var(--color-muted-fg); font-size: 0.875rem; margin-bottom: 1.5rem; }
.block-pricing__features { list-style: none; margin-bottom: 2rem; flex: 1; }
.block-pricing__features li { padding: 0.375rem 0; font-size: 0.9375rem; }
.block-pricing__features li::before { content: '✓ '; color: var(--color-primary); font-weight: 700; }
.block-pricing__card .btn-primary { align-self: stretch; text-align: center; justify-content: center; }

/* ── testimonials ── */
.block-testimonials { background: var(--color-bg); }
.block-testimonials__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 2rem;
}
.block-testimonials__quote {
  font-size: 1.0625rem;
  line-height: 1.7;
  color: var(--color-fg);
  margin-bottom: 1.5rem;
  font-style: italic;
}
.block-testimonials__author { display: flex; align-items: center; gap: 0.75rem; }
.block-testimonials__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--color-border);
  object-fit: cover;
  flex-shrink: 0;
}
.block-testimonials__name { font-weight: 600; font-size: 0.9375rem; }
.block-testimonials__role { color: var(--color-muted-fg); font-size: 0.8125rem; }

/* ── reviews ── */
.block-reviews { background: var(--color-muted); }
.block-reviews__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.5rem;
}
.block-reviews__stars { color: #f59e0b; font-size: 1.125rem; margin-bottom: 0.75rem; }
.block-reviews__text { font-size: 0.9375rem; color: var(--color-fg); margin-bottom: 1rem; }
.block-reviews__meta { font-size: 0.8125rem; color: var(--color-muted-fg); }
.block-reviews__platform {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted-fg);
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

/* ── faq ── */
.block-faq { background: var(--color-bg); }
.block-faq__list { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 0; }
.block-faq__item {
  border-bottom: 1px solid var(--color-border);
}
.block-faq__item:first-child { border-top: 1px solid var(--color-border); }
.block-faq__q {
  font-size: 1rem;
  font-weight: 600;
  padding: 1.25rem 0;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.block-faq__q::after { content: '+'; font-size: 1.25rem; color: var(--color-muted-fg); flex-shrink: 0; }
.block-faq__a {
  display: none;
  color: var(--color-muted-fg);
  padding-bottom: 1.25rem;
  font-size: 0.9375rem;
  line-height: 1.7;
}
.block-faq__item--open .block-faq__q::after { content: '−'; }
.block-faq__item--open .block-faq__a { display: block; }

/* ── team ── */
.block-team { background: var(--color-muted); }
.block-team__card { text-align: center; }
.block-team__photo {
  width: 8rem;
  height: 8rem;
  border-radius: 50%;
  object-fit: cover;
  margin: 0 auto 1rem;
  background: var(--color-border);
}
.block-team__name { font-weight: 700; font-size: 1rem; margin-bottom: 0.25rem; }
.block-team__role { color: var(--color-muted-fg); font-size: 0.875rem; margin-bottom: 0.5rem; }
.block-team__bio { color: var(--color-muted-fg); font-size: 0.875rem; line-height: 1.6; }

/* ── gallery ── */
.block-gallery { background: var(--color-bg); }
.block-gallery__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.block-gallery__item {
  aspect-ratio: 4/3;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--color-muted);
}
.block-gallery__item img { width: 100%; height: 100%; object-fit: cover; }
.block-gallery__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted-fg);
  font-size: 0.875rem;
}
@media (max-width: 600px) {
  .block-gallery__grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── stats ── */
.block-stats { background: var(--color-primary); color: var(--color-primary-fg); }
.block-stats__item { text-align: center; }
.block-stats__value {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1;
  margin-bottom: 0.5rem;
}
.block-stats__label { font-size: 0.875rem; opacity: 0.85; }

/* ── video ── */
.block-video { background: var(--color-muted); }
.block-video__embed-wrap {
  max-width: 900px;
  margin: 0 auto;
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
}
.block-video__embed-wrap iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

/* ── intro-offer ── */
.block-intro-offer {
  background: var(--color-primary);
  color: var(--color-primary-fg);
}
.block-intro-offer__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
}
.block-intro-offer__price {
  font-family: var(--font-heading);
  font-size: clamp(3rem, 8vw, 5rem);
  font-weight: var(--font-heading-weight);
  line-height: 1;
}
.block-intro-offer__period { opacity: 0.8; font-size: 1rem; }
.block-intro-offer__details { opacity: 0.85; max-width: 50ch; }
.block-intro-offer .btn-secondary {
  border-color: var(--color-primary-fg);
  color: var(--color-primary-fg);
}
.block-intro-offer .btn-secondary:hover {
  background: var(--color-primary-fg);
  color: var(--color-primary);
}

/* ── map-location ── */
.block-map-location { background: var(--color-bg); }
.block-map-location__inner {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 3rem;
  align-items: start;
}
.block-map-location__info { display: flex; flex-direction: column; gap: 1rem; }
.block-map-location__info h2 { margin-bottom: 0.5rem; }
.block-map-location__detail { font-size: 0.9375rem; color: var(--color-muted-fg); }
.block-map-location__detail strong { color: var(--color-fg); display: block; margin-bottom: 0.25rem; }
.block-map-location__map {
  border-radius: var(--radius);
  overflow: hidden;
  aspect-ratio: 16/9;
  background: var(--color-muted);
}
.block-map-location__map iframe { width: 100%; height: 100%; border: 0; }
@media (max-width: 768px) {
  .block-map-location__inner { grid-template-columns: 1fr; }
}

/* ── rich-text ── */
.block-rich-text { background: var(--color-bg); }
.block-rich-text__inner { max-width: 800px; margin: 0 auto; }
.block-rich-text__content h1,
.block-rich-text__content h2,
.block-rich-text__content h3 { margin: 1.5rem 0 0.75rem; }
.block-rich-text__content p { margin-bottom: 1rem; color: var(--color-muted-fg); }
.block-rich-text__content ul,
.block-rich-text__content ol { padding-left: 1.5rem; margin-bottom: 1rem; }
.block-rich-text__content li { margin-bottom: 0.375rem; color: var(--color-muted-fg); }

/* ── cta-banner ── */
.block-cta-banner { background: var(--color-muted); }
.block-cta-banner__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}
.block-cta-banner__text h2 { margin-bottom: 0.5rem; }
.block-cta-banner__text p { color: var(--color-muted-fg); font-size: 1rem; }
.block-cta-banner__actions { display: flex; gap: 1rem; flex-wrap: wrap; flex-shrink: 0; }

/* ── faq toggle script ── */
`;
