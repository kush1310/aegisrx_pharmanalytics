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
 * getHistoryKey
 *
 * Derives a namespaced localStorage key from the section label so each
 * page maintains its own independent search history.
 *
 * @param  {string | undefined} sectionLabel - Label used to namespace the key.
 * @returns {string}                         - A deterministic localStorage key.
 */
function getHistoryKey(sectionLabel?: string): string {
  return `aegisrx_sh_${(sectionLabel || 'global').toLowerCase()}`;
}

/**
 * loadHistory
 *
 * Reads the last 8 recent search terms from localStorage for the given key.
 *
 * @param  {string} key - The localStorage key.
 * @returns {string[]}  - Array of recent search terms, newest first.
 */
function loadHistory(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * saveToHistory
 *
 * Prepends a term, deduplicates, trims to 8 entries, and persists.
 *
 * @param  {string} key   - The localStorage key.
 * @param  {string} term  - The search term to save.
 * @returns {string[]}    - Updated history array.
 */
function saveToHistory(key: string, term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed || trimmed.length < 2) return loadHistory(key);
  const prev = loadHistory(key).filter(h => h !== trimmed);
  const updated = [trimmed, ...prev].slice(0, 8);
  try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* quota */ }
  return updated;
}

/**
 * PageSearchBar
 *
 * Extends PremiumSearchBar with:
 *   - Live suggestion dropdown when query length > 0 and suggestions exist.
 *   - Search history dropdown when the input is focused and empty.
 *   - "Clear History" action at the top of the history section.
 *   - History is saved on suggestion click or Enter-key submission.
 *
 * @param  {string}              value              - Controlled input value.
 * @param  {function}            onChange            - Called on every keystroke.
 * @param  {string}              placeholder         - Input placeholder text.
 * @param  {SearchSuggestion[]}  suggestions         - Filtered suggestion list from parent.
 * @param  {function}            onSuggestionClick   - Called when user picks a suggestion.
 * @param  {string}              className           - CSS utility classes for sizing.
 * @param  {string}              sectionLabel        - Category header in dropdown (e.g. "DOCTORS").
 * @param  {function}            onFilterClick       - Optional filter icon callback.
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
  const [history, setHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyKey = getHistoryKey(sectionLabel);

  // Load persisted history on mount and when namespace changes
  useEffect(() => {
    setHistory(loadHistory(historyKey));
  }, [historyKey]);

  const showSuggestions = isFocused && value.trim().length > 0 && suggestions.length > 0;
  const showHistory     = isFocused && value.trim().length === 0 && history.length > 0;

  // Collapse dropdown on outside click
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  /**
   * handleSuggestionSelect
   *
   * Fills input with suggestion text, saves to history, collapses dropdown,
   * and invokes the parent selection callback.
   *
   * @param  {SearchSuggestion} suggestion - The chosen suggestion object.
   */
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    onChange(suggestion.primaryText);
    const updated = saveToHistory(historyKey, suggestion.primaryText);
    setHistory(updated);
    setIsFocused(false);
    onSuggestionClick?.(suggestion);
  };

  /**
   * handleHistorySelect
   *
   * Populates the input with a previously stored search term.
   *
   * @param  {string} term - The historical search term selected by the user.
   */
  const handleHistorySelect = (term: string) => {
    onChange(term);
    setIsFocused(false);
  };

  /**
   * handleClearHistory
   *
   * Erases all stored history entries for this page's namespace.
   *
   * @param  {React.MouseEvent} e - Mouse event (propagation stopped to avoid dropdown close).
   */
  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try { localStorage.removeItem(historyKey); } catch { /* silent */ }
    setHistory([]);
  };

  const dropdownStyle: React.CSSProperties = {
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

      {/* Live Suggestions Dropdown */}
      {showSuggestions && (
        <div style={dropdownStyle}>
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
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: '10px',
                  background: '#eef2ff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {suggestion.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {suggestion.primaryText}
                </div>
                {suggestion.secondaryText && (
                  <div style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {suggestion.secondaryText}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search History Dropdown — shown when input is focused and empty */}
      {showHistory && (
        <div style={dropdownStyle}>
          {/* History header with clear action */}
          <div
            style={{
              padding: '8px 14px 4px',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#94a3b8',
              textTransform: 'uppercase',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Recent Searches</span>
            <button
              type="button"
              onMouseDown={handleClearHistory}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '10px',
                color: '#ef4444',
                fontWeight: 600,
                padding: '1px 4px',
                borderRadius: '4px',
                letterSpacing: '0.04em',
              }}
            >
              Clear
            </button>
          </div>

          {history.map((term, idx) => (
            <button
              key={`hist-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleHistorySelect(term);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '9px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {/* Clock icon — inline SVG, no library dependency */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {term}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
