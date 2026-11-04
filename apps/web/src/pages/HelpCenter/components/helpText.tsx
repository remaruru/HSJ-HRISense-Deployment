import React from 'react';

/**
 * Renders **bold** inside Help Center callout text (what you should see, tips,
 * warnings, notes, explanations, what happens next, troubleshooting). The guides
 * use the same **…** marks as the step instructions; without this they showed
 * the raw asterisks. Instructions keep their own button-label styling.
 */
export function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index} className="font-bold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );
}
