import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";

interface ContactFormFields {
  headline?: string;
  subheadline?: string;
  include_phone?: boolean;
  submit_label?: string;
  recipient_email?: string;
}

export function render(section: Record<string, unknown>, _theme: Theme, profile: BusinessProfile | null): string {
  const s = section as unknown as ContactFormFields;
  const headline = interpolate(s.headline ?? "Get in touch", profile);
  const subheadline = s.subheadline ? interpolate(s.subheadline, profile) : null;
  const submitLabel = s.submit_label ?? "Send message";
  const recipient = s.recipient_email ?? profile?.email ?? "";
  const formAction = recipient ? `mailto:${encodeURIComponent(recipient)}` : "#";

  return `<section class="block-contact-form">
  <div class="container">
    <div class="block-contact-form__inner">
      <div class="block-contact-form__header">
        <h2>${esc(headline)}</h2>
        ${subheadline ? `<p>${esc(subheadline)}</p>` : ""}
      </div>
      <form class="block-contact-form__form" action="${esc(formAction)}" method="GET" enctype="text/plain">
        <div class="block-contact-form__row">
          <label class="block-contact-form__label" for="cf-name-${esc(section.id as string)}">Name</label>
          <input class="block-contact-form__input" id="cf-name-${esc(section.id as string)}" name="name" type="text" placeholder="Your name" required />
        </div>
        <div class="block-contact-form__row">
          <label class="block-contact-form__label" for="cf-email-${esc(section.id as string)}">Email</label>
          <input class="block-contact-form__input" id="cf-email-${esc(section.id as string)}" name="email" type="email" placeholder="your@email.com" required />
        </div>
        ${s.include_phone ? `<div class="block-contact-form__row">
          <label class="block-contact-form__label" for="cf-phone-${esc(section.id as string)}">Phone</label>
          <input class="block-contact-form__input" id="cf-phone-${esc(section.id as string)}" name="phone" type="tel" placeholder="(555) 000-0000" />
        </div>` : ""}
        <div class="block-contact-form__row">
          <label class="block-contact-form__label" for="cf-msg-${esc(section.id as string)}">Message</label>
          <textarea class="block-contact-form__input block-contact-form__textarea" id="cf-msg-${esc(section.id as string)}" name="body" rows="5" placeholder="How can we help?" required></textarea>
        </div>
        <button class="btn-primary block-contact-form__submit" type="submit">${esc(submitLabel)}</button>
      </form>
    </div>
  </div>
</section>`;
}
