'use client';

import { useEffect, useRef } from 'react';

function extractTweetId(url) {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

export default function TweetEmbeds() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const placeholders = document.querySelectorAll('[data-tweet-url]');
    if (!placeholders.length) return;

    function renderAll() {
      placeholders.forEach((el) => {
        const url = el.getAttribute('data-tweet-url');
        const tweetId = extractTweetId(url);
        if (!tweetId) {
          // No status ID (e.g. article URLs), show a link instead
          el.innerHTML = '';
          return;
        }
        window.twttr.widgets.createTweet(tweetId, el, {
          dnt: true,
          conversation: 'none',
        });
      });
    }

    if (window.twttr?.widgets) {
      renderAll();
    } else {
      if (!document.querySelector('script[src*="platform.twitter.com"]')) {
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        document.head.appendChild(script);
      }
      const interval = setInterval(() => {
        if (window.twttr?.widgets) {
          clearInterval(interval);
          renderAll();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  return null;
}
