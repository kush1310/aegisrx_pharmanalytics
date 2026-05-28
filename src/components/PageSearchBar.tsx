import React, { useState, useRef, useEffect } from 'react';
import PremiumSearchBar from './PremiumSearchBar';

export interface SearchSuggestion {
  id: number | string;
  primaryText: string;
  secondaryText?: string;
  icon: React.ReactNode;
}

interface PageSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: SearchSuggestion[];
  onSuggestionClick?: (suggestion: SearchSuggestion) => void;
  className?: string;
  sectionLabel?: string;
  onFilterClick?: () => void;
}

/**
 * PageSearchBar
 *
 * Extends PremiumSearchBar with a context-scoped suggestion dropdown.
 * Unlike the global header search, this shows ONLY data relevant to the
 * page it is placed on (e.g., products on the Products page, doctors on
 * the Doctors page). Suggestions are supplied by the parent page via the
 * `suggestions` prop and filtered/ranked there.
 *
 * Dropdown opens when the input has focus AND the query is non-empty.
 * Clicking a suggestion calls onSuggestionClick and closes the dropdown.
 * Clicking outside dismisses the dropdown.
 *
 * @param  {string}              value               - Controlled input value.
 * @param  {function}            onChange             - Called on every keystroke.
 * @param  {string}              placeholder          - Input placeholder text.
 * @param  {SearchSuggestion[]}  suggestions          - Filtered suggestion list from parent.
 * @param  {function}            onSuggestionClick    - Called when user picks a suggestion.
 * @param  {string}              className            - Tailwind utility classes for sizing.
 * @param  {string}              sectionLabel         - Category header in dropdown (e.g. "DOCTORS").
 * @param  {function}            onFilterClick        - Optional filter icon callback.
 */
export default function PageSearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  suggestions,
  onSuggestionClick,
  className = '',
  sectionLabel,
  onFilterClick,
}: PageSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showDropdown = isFocused && value.trim().length > 0 && suggestions.length > 0;

  // Close dropdown when user clicks outside the component
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    onChange(suggestion.primaryText);
    setIsFocused(false);
    onSuggestionClick?.(suggestion);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', zIndex: 50 }}
      className={className}
      onFocus={() => setIsFocused(true)}
    >
      <PremiumSearchBar
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFilterClick={onFilterClick}
      />

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(99,102,241,0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            zIndex: 100,
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {sectionLabel && (
            <div
              style={{
                padding: '8px 14px 4px',
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#6366f1',
                textTransform: 'uppercase',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              {sectionLabel}
            </div>
          )}

          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseDown={(e) => {
                // Use mousedown instead of click to fire before the blur event
                e.preventDefault();
                handleSuggestionSelect(suggestion);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: '#eef2ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {suggestion.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {suggestion.primaryText}
                </div>
                {suggestion.secondaryText && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {suggestion.secondaryText}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
