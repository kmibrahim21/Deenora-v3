import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Transforms plain URLs in raw text into Markdown links without corrupting existing markdown syntax.
 */
export const linkifyMarkdown = (text: string): string => {
  if (!text) return '';
  
  // 1. Normalize line breaks
  let processed = text.replace(/\r\n/g, '\n');

  // 2. Temporarily protect already formatted markdown links [text](url) and images ![text](url)
  const protectedLinks: string[] = [];
  processed = processed.replace(/(!?\[[^\]]*\]\([^)]+\))/g, (match) => {
    protectedLinks.push(match);
    return `___MD_PROTECTED_LINK_${protectedLinks.length - 1}___`;
  });

  // 3. Convert bare URLs (https://, http://, www.)
  processed = processed.replace(/(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/gi, (rawUrl) => {
    let cleanUrl = rawUrl;
    let trailingPunctuation = '';
    
    // Strip trailing common punctuation attached to sentences
    const punctMatch = cleanUrl.match(/[.,;!?)>]+$/);
    if (punctMatch) {
      trailingPunctuation = punctMatch[0];
      cleanUrl = cleanUrl.slice(0, -trailingPunctuation.length);
    }

    if (!cleanUrl) return rawUrl;

    const href = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;
    return `[${cleanUrl}](${href})${trailingPunctuation}`;
  });

  // 4. Restore protected markdown links
  processed = processed.replace(/___MD_PROTECTED_LINK_(\d+)___/g, (_, index) => {
    return protectedLinks[parseInt(index, 10)] || '';
  });

  // 5. Add double trailing spaces before newlines for markdown paragraph/line breaks
  processed = processed.replace(/\n/g, '  \n');

  return processed;
};

/**
 * Generates custom ReactMarkdown renderers with full link support and YouTube styling.
 */
export const getMarkdownComponents = (isDark = false) => {
  return {
    p: ({ children }: any) => (
      <p className={`my-2 leading-relaxed text-[13px] sm:text-sm font-extrabold ${isDark ? 'text-slate-100' : 'text-slate-950'}`}>
        {children}
      </p>
    ),
    h1: ({ children }: any) => (
      <h1 className={`text-base sm:text-lg font-black tracking-tight mt-4 mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className={`text-sm sm:text-base font-black tracking-tight mt-4 mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className={`text-xs sm:text-sm font-black tracking-tight mt-3 mb-1.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
        {children}
      </h3>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc pl-5 my-2 space-y-1.5">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal pl-5 my-2 space-y-1.5">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className={`text-[12px] sm:text-[13px] font-extrabold leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
        {children}
      </li>
    ),
    strong: ({ children }: any) => (
      <strong className={`font-black px-1.5 py-0.5 rounded-[0.4rem] text-xs sm:text-[13px] inline-block shadow-sm ${
        isDark 
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
          : 'bg-amber-100 text-amber-950 border border-amber-200/80'
      }`}>
        {children}
      </strong>
    ),
    em: ({ children }: any) => (
      <em className="italic font-bold opacity-95">
        {children}
      </em>
    ),
    code: ({ children }: any) => (
      <code className={`px-1.5 py-0.5 rounded font-mono text-xs ${
        isDark 
          ? 'bg-slate-800 text-pink-400 border border-slate-700' 
          : 'bg-slate-100 text-pink-600 border border-slate-200'
      }`}>
        {children}
      </code>
    ),
    a: ({ href, children, ...props }: any) => {
      const rawHref = href || '';
      const isYouTube = rawHref.toLowerCase().includes('youtube.com') || rawHref.toLowerCase().includes('youtu.be');
      const safeHref = rawHref.startsWith('www.') ? `https://${rawHref}` : (rawHref || '#');

      const handleLinkClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (safeHref && safeHref !== '#') {
          try {
            window.open(safeHref, '_blank', 'noopener,noreferrer');
          } catch (_) {
            window.location.href = safeHref;
          }
        }
      };

      return (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md active:scale-95 no-underline select-none ${
            isYouTube
              ? 'bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-400/40 shadow-red-600/30'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/40 shadow-blue-600/30'
          }`}
          {...props}
        >
          {isYouTube ? (
            <svg className="w-4 h-4 shrink-0 fill-current text-white" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          ) : (
            <ExternalLink size={13} className="shrink-0 text-white" />
          )}
          <span className="font-noto truncate max-w-[200px] sm:max-w-[280px]">
            {children}
          </span>
          <ExternalLink size={11} className="opacity-75 shrink-0 text-white" />
        </a>
      );
    }
  };
};
