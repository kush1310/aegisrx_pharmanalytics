import React from 'react';

interface PremiumSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFilterClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * PremiumSearchBar
 *
 * A highly styled, interactive search bar component redesigned for light mode
 * with rotating gradients, focus glows, and custom vector icons.
 *
 * @param {string} value              - Current input value.
 * @param {function} onChange         - Callback triggered on text change.
 * @param {string} placeholder        - Placeholder text for the search field.
 * @param {function} onFilterClick    - Optional callback to show and handle the filter button.
 * @param {object} style              - Custom inline styles for the outer container.
 * @param {string} className          - Tailwind CSS classes to control sizing and layout.
 */
export default function PremiumSearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  onFilterClick,
  style,
  className = ''
}: PremiumSearchBarProps) {
  const hasFilter = typeof onFilterClick === 'function';

  return (
    <div 
      className={`premium-search-container ${className}`} 
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '56px',
        width: '100%',
        zIndex: 1,
        ...style
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .premium-search-container .premium-search-glow,
        .premium-search-container .premium-search-darkBorderBg,
        .premium-search-container .premium-search-white,
        .premium-search-container .premium-search-border {
          height: 100%;
          width: 100%;
          position: absolute;
          overflow: hidden;
          z-index: -1;
          border-radius: 12px;
          filter: blur(3px);
          pointer-events: none;
        }

        .premium-search-container .premium-search-glow {
          filter: blur(24px);
          opacity: 0.35;
          height: calc(100% + 20px);
          width: calc(100% + 20px);
          top: -10px;
          left: -10px;
        }

        .premium-search-container .premium-search-glow::before {
          content: "";
          z-index: -2;
          text-align: center;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(60deg);
          position: absolute;
          width: 2000px;
          height: 2000px;
          background-repeat: no-repeat;
          background-position: 0 0;
          background-image: conic-gradient(
            rgba(255, 255, 255, 0) 0%,
            rgba(99, 102, 241, 0.45) 5%,
            rgba(255, 255, 255, 0) 38%,
            rgba(255, 255, 255, 0) 50%,
            rgba(236, 72, 153, 0.45) 60%,
            rgba(255, 255, 255, 0) 87%
          );
          transition: all 2s ease-in-out;
        }

        .premium-search-container .premium-search-darkBorderBg::before {
          content: "";
          z-index: -2;
          text-align: center;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(82deg);
          position: absolute;
          width: 2000px;
          height: 2000px;
          background-repeat: no-repeat;
          background-position: 0 0;
          background-image: conic-gradient(
            rgba(255, 255, 255, 0) 0%,
            #e0e7ff 10%,
            rgba(255, 255, 255, 0) 20%,
            rgba(255, 255, 255, 0) 50%,
            #fce7f3 60%,
            rgba(255, 255, 255, 0) 70%
          );
          transition: all 2s ease-in-out;
        }

        .premium-search-container .premium-search-white {
          filter: blur(2px);
          height: calc(100% - 2px);
          width: calc(100% - 2px);
          top: 1px;
          left: 1px;
        }

        .premium-search-container .premium-search-white::before {
          content: "";
          z-index: -2;
          text-align: center;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(83deg);
          position: absolute;
          width: 2000px;
          height: 2000px;
          background-repeat: no-repeat;
          background-position: 0 0;
          filter: brightness(1.1);
          background-image: conic-gradient(
            rgba(255, 255, 255, 0) 0%,
            #cbd5e1,
            rgba(255, 255, 255, 0) 8%,
            rgba(255, 255, 255, 0) 50%,
            #cbd5e1,
            rgba(255, 255, 255, 0) 58%
          );
          transition: all 2s ease-in-out;
        }

        .premium-search-container .premium-search-border {
          filter: blur(0.5px);
          height: calc(100% - 4px);
          width: calc(100% - 4px);
          top: 2px;
          left: 2px;
        }

        .premium-search-container .premium-search-border::before {
          content: "";
          z-index: -2;
          text-align: center;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(70deg);
          position: absolute;
          width: 2000px;
          height: 2000px;
          filter: brightness(1.05);
          background-repeat: no-repeat;
          background-position: 0 0;
          background-image: conic-gradient(
            #f8fafc,
            #818cf8 5%,
            #f8fafc 14%,
            #f8fafc 50%,
            #f472b6 60%,
            #f8fafc 64%
          );
          transition: all 2s ease-in-out;
        }

        /* Hover animations */
        .premium-search-container:hover .premium-search-darkBorderBg::before {
          transform: translate(-50%, -50%) rotate(-98deg);
        }
        .premium-search-container:hover .premium-search-glow::before {
          transform: translate(-50%, -50%) rotate(-120deg);
        }
        .premium-search-container:hover .premium-search-white::before {
          transform: translate(-50%, -50%) rotate(-97deg);
        }
        .premium-search-container:hover .premium-search-border::before {
          transform: translate(-50%, -50%) rotate(-110deg);
        }

        /* Focus within animations */
        .premium-search-container:focus-within .premium-search-darkBorderBg::before {
          transform: translate(-50%, -50%) rotate(442deg);
          transition: all 4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-search-container:focus-within .premium-search-glow::before {
          transform: translate(-50%, -50%) rotate(420deg);
          transition: all 4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-search-container:focus-within .premium-search-white::before {
          transform: translate(-50%, -50%) rotate(443deg);
          transition: all 4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-search-container:focus-within .premium-search-border::before {
          transform: translate(-50%, -50%) rotate(430deg);
          transition: all 4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-search-container .premium-search-main {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
        }

        .premium-search-container .premium-search-input {
          background-color: #ffffff;
          border: none;
          width: 100%;
          height: 100%;
          border-radius: 11px;
          color: #0f172a;
          padding-left: 56px;
          padding-right: ${hasFilter ? '56px' : '20px'};
          font-size: 15px;
          font-weight: 500;
          outline: none;
          transition: all 0.3s;
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.03);
          caret-color: #6366f1;
        }

        .premium-search-container .premium-search-input::placeholder {
          color: #94a3b8;
        }

        .premium-search-container .premium-search-input-mask {
          pointer-events: none;
          width: 80px;
          height: 24px;
          position: absolute;
          background: linear-gradient(90deg, transparent, #ffffff);
          top: 16px;
          right: ${hasFilter ? '56px' : '20px'};
        }

        .premium-search-container:focus-within .premium-search-input-mask {
          display: none;
        }

        .premium-search-container .premium-search-pink-mask {
          pointer-events: none;
          width: 40px;
          height: 24px;
          position: absolute;
          background: #818cf8;
          top: 16px;
          left: 12px;
          filter: blur(16px);
          opacity: 0.45;
          transition: all 1.5s;
        }

        .premium-search-container:hover .premium-search-pink-mask {
          opacity: 0;
        }

        .premium-search-container .premium-search-search-icon {
          position: absolute;
          left: 18px;
          top: 16px;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .premium-search-container .premium-search-filter-icon {
          position: absolute;
          top: 7px;
          right: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          height: 42px;
          width: 42px;
          border-radius: 9px;
          background: linear-gradient(180deg, #ffffff, #f8fafc, #f1f5f9);
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
        }

        .premium-search-container .premium-search-filter-icon:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          background: linear-gradient(180deg, #f8fafc, #f1f5f9, #e2e8f0);
          border-color: #cbd5e1;
        }

        .premium-search-container .premium-search-filter-icon:active {
          transform: translateY(0);
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .premium-search-container .premium-search-filterBorder {
          height: 44px;
          width: 44px;
          position: absolute;
          overflow: hidden;
          top: 6px;
          right: 6px;
          border-radius: 10px;
          pointer-events: none;
        }

        .premium-search-container .premium-search-filterBorder::before {
          content: "";
          text-align: center;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(90deg);
          position: absolute;
          width: 300px;
          height: 300px;
          background-repeat: no-repeat;
          background-position: 0 0;
          filter: brightness(1.05);
          background-image: conic-gradient(
            rgba(255, 255, 255, 0),
            #cbd5e1,
            rgba(255, 255, 255, 0) 50%,
            rgba(255, 255, 255, 0) 50%,
            #cbd5e1,
            rgba(255, 255, 255, 0) 100%
          );
          animation: premium-rotate 4s linear infinite;
        }

        @keyframes premium-rotate {
          100% {
            transform: translate(-50%, -50%) rotate(450deg);
          }
        }
      `}} />

      <div className="premium-search-glow"></div>
      <div className="premium-search-darkBorderBg"></div>
      <div className="premium-search-darkBorderBg"></div>
      <div className="premium-search-darkBorderBg"></div>
      <div className="premium-search-white"></div>
      <div className="premium-search-border"></div>

      <div className="premium-search-main" id="main">
        <input 
          placeholder={placeholder} 
          type="text" 
          name="text" 
          className="premium-search-input"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
        <div className="premium-search-input-mask"></div>
        <div className="premium-search-pink-mask"></div>
        
        {hasFilter && (
          <>
            <div className="premium-search-filterBorder"></div>
            <div className="premium-search-filter-icon" onClick={onFilterClick}>
              <svg
                preserveAspectRatio="none"
                height="20"
                width="20"
                viewBox="4.8 4.56 14.832 15.408"
                fill="none"
              >
                <path
                  d="M8.16 6.65002H15.83C16.47 6.65002 16.99 7.17002 16.99 7.81002V9.09002C16.99 9.56002 16.7 10.14 16.41 10.43L13.91 12.64C13.56 12.93 13.33 13.51 13.33 13.98V16.48C13.33 16.83 13.1 17.29 12.81 17.47L12 17.98C11.24 18.45 10.2 17.92 10.2 16.99V13.91C10.2 13.5 9.97 12.98 9.73 12.69L7.52 10.36C7.23 10.08 7 9.55002 7 9.20002V7.87002C7 7.17002 7.52 6.65002 8.16 6.65002Z"
                  stroke="#475569"
                  strokeWidth="1.5"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
            </div>
          </>
        )}

        <div className="premium-search-search-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          >
            <circle stroke="url(#premium-search-grad)" r="8" cy="11" cx="11"></circle>
            <line
              stroke="url(#premium-search-grad-line)"
              y2="16.65"
              y1="22"
              x2="16.65"
              x1="22"
            ></line>
            <defs>
              <linearGradient gradientTransform="rotate(50)" id="premium-search-grad">
                <stop stopColor="#6366f1" offset="0%"></stop>
                <stop stopColor="#a78bfa" offset="50%"></stop>
              </linearGradient>
              <linearGradient id="premium-search-grad-line">
                <stop stopColor="#a78bfa" offset="0%"></stop>
                <stop stopColor="#ec4899" offset="50%"></stop>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
