import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

/* Everything here is public at its source — a shop's own menu, the state's
   own registry — and this site is read the way we read shops: openly. So
   search engines, link previews and the assistants that answer people's
   questions with a link are all welcome.

   What is asked to stay out is training: crawlers that copy pages into a
   model and send no one back. robots.txt is a request, not a lock — the
   crawlers named here say they honour it, and the ones that do not were
   never going to be stopped by it. Google-Extended and Applebot-Extended
   only govern training; Google and Apple search still read every page. */
const AI_TRAINING = [
  'GPTBot', // OpenAI
  'ClaudeBot', // Anthropic
  'anthropic-ai',
  'Google-Extended', // Gemini training; not Google Search
  'Applebot-Extended', // Apple Intelligence training; not Apple search
  'CCBot', // Common Crawl, the corpus most models start from
  'meta-externalagent', // Meta AI
  'FacebookBot', // Meta's language-model crawler; link previews are facebookexternalhit
  'Bytespider', // ByteDance
  'cohere-ai',
  'cohere-training-data-crawler',
  'AI2Bot', // Allen Institute
  'Diffbot',
  'Omgilibot', // sells crawled data for training
  'Timpibot',
  'ImagesiftBot',
  'img2dataset',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: AI_TRAINING, disallow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
