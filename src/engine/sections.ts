/**
 * Arch Email Editor - Prebuilt Modular Email Sections Catalog
 *
 * Provides a production-grade library of 100% email-client-safe prebuilt sections.
 * Each section is formatted with standard table layouts, responsive inline styles,
 * and high-fidelity SVG thumbnails.
 */

import { PrebuiltSection } from '../types';

export const DEFAULT_PREBUILT_SECTIONS: PrebuiltSection[] = [
  // ─── Headers ─────────────────────────────────────────────────────────────
  {
    id: 'header-brand-nav',
    name: 'Logo & Navigation',
    category: 'Header',
    description: 'Header with brand logo on the left and quick navigation links on the right.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#f8fafc" rx="4"/>
      <rect x="16" y="32" width="40" height="16" rx="3" fill="#6366f1"/>
      <rect x="92" y="36" width="16" height="8" rx="2" fill="#94a3b8"/>
      <rect x="114" y="36" width="16" height="8" rx="2" fill="#94a3b8"/>
      <rect x="136" y="36" width="16" height="8" rx="2" fill="#94a3b8"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-header" style="background-color: #ffffff; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 24px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; border-collapse: collapse;">
        <tr>
          <td align="left" valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <a href="https://example.com" style="text-decoration: none; font-size: 20px; font-weight: 700; color: #1e293b; letter-spacing: -0.5px;">ACME Inc.</a>
          </td>
          <td align="right" valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px;">
            <a href="#" style="color: #64748b; text-decoration: none; margin-left: 16px; font-weight: 500;">Features</a>
            <a href="#" style="color: #64748b; text-decoration: none; margin-left: 16px; font-weight: 500;">Pricing</a>
            <a href="#" style="color: #64748b; text-decoration: none; margin-left: 16px; font-weight: 500;">Blog</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },
  {
    id: 'header-centered',
    name: 'Centered Brand Logo',
    category: 'Header',
    description: 'Clean minimalist header with a centered brand emblem and online view link.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#f8fafc" rx="4"/>
      <rect x="62" y="24" width="36" height="18" rx="3" fill="#6366f1"/>
      <rect x="52" y="50" width="56" height="6" rx="2" fill="#cbd5e1"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-header-centered" style="background-color: #ffffff; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 30px 20px 20px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; text-align: center;">
        <tr>
          <td align="center">
            <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
              ARCH BRAND
            </h1>
            <p style="margin: 6px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #64748b;">
              The weekly dispatch for modern design & engineering
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // ─── Hero Banners ─────────────────────────────────────────────────────────
  {
    id: 'hero-headline-cta',
    name: 'Hero Banner with CTA',
    category: 'Hero',
    description: 'High-conversion hero section with compelling title, copy, and action button.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#f8fafc" rx="4"/>
      <rect x="30" y="16" width="100" height="12" rx="2" fill="#1e293b"/>
      <rect x="40" y="34" width="80" height="7" rx="2" fill="#94a3b8"/>
      <rect x="55" y="45" width="50" height="7" rx="2" fill="#94a3b8"/>
      <rect x="58" y="58" width="44" height="14" rx="4" fill="#6366f1"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-hero" style="background-color: #f8fafc; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 48px 24px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; text-align: center;">
        <tr>
          <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="display: inline-block; padding: 4px 12px; background-color: #e0e7ff; color: #4338ca; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">
              What's New
            </div>
            <h1 style="margin: 0 0 16px 0; font-size: 32px; font-weight: 800; line-height: 1.25; color: #0f172a; letter-spacing: -0.5px;">
              Build better newsletters in minutes, not hours.
            </h1>
            <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #475569; max-width: 480px;">
              Experience the next generation email editor designed for developers and designers. Clean code, zero bloat, and pixel perfection.
            </p>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center" style="border-radius: 6px; background-color: #4f46e5;">
                  <a href="https://example.com" class="button" style="font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 28px; display: inline-block; border-radius: 6px; background-color: #4f46e5;">
                    Get Started Free &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },
  {
    id: 'hero-split-image',
    name: 'Hero 2-Col Split',
    category: 'Hero',
    description: 'Two-column hero layout with text and CTA on the left and visual media on the right.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#f8fafc" rx="4"/>
      <rect x="16" y="20" width="55" height="10" rx="2" fill="#1e293b"/>
      <rect x="16" y="34" width="45" height="6" rx="2" fill="#94a3b8"/>
      <rect x="16" y="44" width="50" height="6" rx="2" fill="#94a3b8"/>
      <rect x="16" y="56" width="36" height="12" rx="3" fill="#6366f1"/>
      <rect x="85" y="16" width="60" height="52" rx="4" fill="#cbd5e1"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-hero-split" style="background-color: #ffffff; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 40px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
          <td class="column" width="50%" valign="middle" style="padding: 0 15px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <h2 style="margin: 0 0 14px 0; font-size: 26px; font-weight: 800; line-height: 1.3; color: #0f172a;">
              Transform your email workflow
            </h2>
            <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 1.6; color: #475569;">
              Drag and drop modular rows, style columns with ease, and export clean, production-ready HTML code instantly.
            </p>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border-radius: 6px; background-color: #0f172a;">
                  <a href="#" class="button" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 22px; display: inline-block; border-radius: 6px; background-color: #0f172a;">
                    Explore Now
                  </a>
                </td>
              </tr>
            </table>
          </td>
          <td class="column" width="50%" valign="middle" style="padding: 0 0 0 15px; text-align: center;">
            <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&auto=format&fit=crop&q=80" alt="Product Preview" style="width: 100%; max-width: 270px; height: auto; border-radius: 8px; display: block;" />
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // ─── Features ─────────────────────────────────────────────────────────────
  {
    id: 'features-3col',
    name: '3-Column Features Grid',
    category: 'Features',
    description: 'Three responsive columns highlighting benefits, features, or product stats.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#f8fafc" rx="4"/>
      <rect x="14" y="16" width="38" height="24" rx="3" fill="#e0e7ff"/>
      <rect x="18" y="46" width="30" height="6" rx="2" fill="#1e293b"/>
      <rect x="18" y="56" width="26" height="5" rx="1.5" fill="#94a3b8"/>

      <rect x="61" y="16" width="38" height="24" rx="3" fill="#e0e7ff"/>
      <rect x="65" y="46" width="30" height="6" rx="2" fill="#1e293b"/>
      <rect x="65" y="56" width="26" height="5" rx="1.5" fill="#94a3b8"/>

      <rect x="108" y="16" width="38" height="24" rx="3" fill="#e0e7ff"/>
      <rect x="112" y="46" width="30" height="6" rx="2" fill="#1e293b"/>
      <rect x="112" y="56" width="26" height="5" rx="1.5" fill="#94a3b8"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-features" style="background-color: #ffffff; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 40px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
          <td class="column" width="33.33%" valign="top" style="padding: 0 10px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; line-height: 44px; margin-bottom: 14px;">⚡</div>
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a;">Lightning Fast</h3>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">Instant live updates, instant rendering, and rapid exports.</p>
          </td>
          <td class="column" width="33.33%" valign="top" style="padding: 0 10px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #ecfdf5; color: #059669; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; line-height: 44px; margin-bottom: 14px;">🛡️</div>
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a;">Client Safe</h3>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">Tested across Outlook, Gmail, Apple Mail, and Yahoo.</p>
          </td>
          <td class="column" width="33.33%" valign="top" style="padding: 0 10px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #f5f3ff; color: #7c3aed; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; line-height: 44px; margin-bottom: 14px;">🎨</div>
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a;">Full Control</h3>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">Custom buttons, fonts, column widths, and responsive styles.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },
  {
    id: 'features-2col',
    name: '2-Column Feature Cards',
    category: 'Features',
    description: 'Two balanced cards with image previews, titles, and descriptive summaries.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#f8fafc" rx="4"/>
      <rect x="16" y="16" width="58" height="28" rx="3" fill="#cbd5e1"/>
      <rect x="16" y="50" width="45" height="7" rx="2" fill="#1e293b"/>
      <rect x="16" y="60" width="52" height="5" rx="1.5" fill="#94a3b8"/>

      <rect x="86" y="16" width="58" height="28" rx="3" fill="#cbd5e1"/>
      <rect x="86" y="50" width="45" height="7" rx="2" fill="#1e293b"/>
      <rect x="86" y="60" width="52" height="5" rx="1.5" fill="#94a3b8"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-features-2col" style="background-color: #f8fafc; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 36px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
          <td class="column" width="50%" valign="top" style="padding: 0 10px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <h4 style="margin: 0 0 8px 0; font-size: 17px; font-weight: 700; color: #0f172a;">Modular Components</h4>
              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                Compose clean newsletters using drag-and-drop building blocks designed for high engagement.
              </p>
              <a href="#" style="font-size: 13px; font-weight: 600; color: #4f46e5; text-decoration: none;">Learn more &rarr;</a>
            </div>
          </td>
          <td class="column" width="50%" valign="top" style="padding: 0 0 0 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <h4 style="margin: 0 0 8px 0; font-size: 17px; font-weight: 700; color: #0f172a;">Responsive Layouts</h4>
              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                Columns stack automatically on mobile viewports for effortless reading on any smartphone.
              </p>
              <a href="#" style="font-size: 13px; font-weight: 600; color: #4f46e5; text-decoration: none;">Learn more &rarr;</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // ─── Call to Action ───────────────────────────────────────────────────────
  {
    id: 'cta-banner',
    name: 'Call to Action Banner',
    category: 'Call to Action',
    description: 'High-contrast focused CTA block with bold headline and prominent button.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#1e1b4b" rx="4"/>
      <rect x="25" y="20" width="110" height="12" rx="2" fill="#ffffff"/>
      <rect x="40" y="38" width="80" height="6" rx="2" fill="#c7d2fe"/>
      <rect x="58" y="52" width="44" height="14" rx="4" fill="#6366f1"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-cta" style="background-color: #1e1b4b; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 48px 24px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 0 auto; text-align: center;">
        <tr>
          <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <h2 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
              Ready to elevate your email marketing?
            </h2>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #c7d2fe;">
              Join thousands of creators delivering stunning emails with unmatched reliability.
            </p>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center" style="border-radius: 6px; background-color: #6366f1;">
                  <a href="https://example.com" class="button" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 13px 28px; display: inline-block; border-radius: 6px; background-color: #6366f1;">
                    Get Started Today &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // ─── Article / Story ──────────────────────────────────────────────────────
  {
    id: 'article-story',
    name: 'Featured Story / Article',
    category: 'Content',
    description: 'Editorial article section with image, publish date tag, and story teaser.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#f8fafc" rx="4"/>
      <rect x="16" y="16" width="128" height="26" rx="3" fill="#cbd5e1"/>
      <rect x="16" y="48" width="30" height="5" rx="1.5" fill="#6366f1"/>
      <rect x="16" y="58" width="90" height="7" rx="2" fill="#1e293b"/>
      <rect x="16" y="68" width="110" height="5" rx="1.5" fill="#94a3b8"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-article" style="background-color: #ffffff; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 32px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <tr>
          <td>
            <img src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=80" alt="Article Banner" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; display: block; margin-bottom: 18px;" />
            <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #4f46e5; letter-spacing: 0.5px; margin-bottom: 6px;">
              Featured Deep Dive
            </div>
            <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
              Mastering Modern Email Typography & Layouts
            </h2>
            <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
              Discover how modern rendering engines handle system fonts, line heights, and web fonts across major desktop and mobile email clients.
            </p>
            <a href="#" style="font-size: 14px; font-weight: 600; color: #0f172a; text-decoration: underline;">
              Read the complete guide &rarr;
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // ─── Footers ──────────────────────────────────────────────────────────────
  {
    id: 'footer-standard',
    name: 'Standard Footer & Unsubscribe',
    category: 'Footer',
    description: 'Legal compliance footer with social media icons, address, and unsubscribe links.',
    thumbnail: `<svg viewBox="0 0 160 80" width="100%" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="80" fill="#0f172a" rx="4"/>
      <circle cx="60" cy="26" r="6" fill="#475569"/>
      <circle cx="80" cy="26" r="6" fill="#475569"/>
      <circle cx="100" cy="26" r="6" fill="#475569"/>
      <rect x="35" y="42" width="90" height="6" rx="2" fill="#334155"/>
      <rect x="45" y="54" width="70" height="5" rx="1.5" fill="#334155"/>
    </svg>`,
    html: `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="row arch-section-footer" style="background-color: #0f172a; width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 40px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <tr>
          <td align="center">
            <div style="margin-bottom: 18px;">
              <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 10px; font-size: 13px;">Twitter</a>
              <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 10px; font-size: 13px;">GitHub</a>
              <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 10px; font-size: 13px;">LinkedIn</a>
            </div>
            <p style="margin: 0 0 10px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
              &copy; 2026 ACME Inc. All rights reserved.<br>
              100 Tech Blvd, Suite 400, San Francisco, CA 94107
            </p>
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              You received this email because you subscribed to our newsletter.<br>
              <a href="{{unsubscribe_url}}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a> or
              <a href="#" style="color: #94a3b8; text-decoration: underline;">Manage Preferences</a>.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  }
];

/**
 * Returns a defensive copy of the default prebuilt modular sections.
 */
export function getDefaultSections(): PrebuiltSection[] {
  return JSON.parse(JSON.stringify(DEFAULT_PREBUILT_SECTIONS));
}
