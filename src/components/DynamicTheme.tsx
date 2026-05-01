import React from 'react';

export default function DynamicTheme({ config }: { config: any }) {
  if (!config) return null;
  
  // Helper to determine if a hex color is dark or light
  const getContrastColor = (hexcolor: string) => {
    if (!hexcolor || hexcolor === 'transparent') return '#000000';
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
  };

  const getSecondaryContrastColor = (hexcolor: string) => {
    if (!hexcolor || hexcolor === 'transparent') return 'rgba(0,0,0,0.5)';
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)';
  };

  const adaptivePrimary = getContrastColor(config.siteBgColor || '#ffffff');
  const adaptiveSecondary = getSecondaryContrastColor(config.siteBgColor || '#ffffff');
  const adaptiveSeparator = adaptivePrimary === '#000000' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';

  // Only apply theme if colors are not the default ones
  const isDefault = 
    (!config.siteBgColor || config.siteBgColor === '#ffffff') &&
    (!config.primaryFontColor || config.primaryFontColor === '#000000') &&
    (!config.btnBgColor || config.btnBgColor === '#000000') &&
    (!config.btnTextColor || config.btnTextColor === '#ffffff');

  if (isDefault) return null;

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        --site-bg: ${config.siteBgColor || '#ffffff'};
        --primary-font: ${config.primaryFontColor || '#000000'};
        --secondary-font: ${config.secondaryFontColor || '#9ca3af'};
        --btn-bg: ${config.btnBgColor || '#000000'};
        --btn-text: ${config.btnTextColor || '#ffffff'};
      }
      
      body {
        background-color: var(--site-bg);
      }
      
      .font-serif, h1, h2, h3, h4, .text-gray-900 {
        color: var(--primary-font) !important;
      }

      .text-gray-500, .text-gray-400, .text-gray-600 {
        color: var(--secondary-font) !important;
      }

      .bg-black, .bg-gray-900 {
        background-color: var(--btn-bg) !important;
        color: var(--btn-text) !important;
      }

      .text-white {
        color: var(--btn-text) !important;
      }
      
      .border-gray-100, .border-gray-200 {
        border-color: var(--secondary-font) !important;
      }

      /* Specific fixes for UI visibility */
      input, textarea, select {
        background-color: #ffffff !important;
        color: #000000 !important;
        border-color: #e5e7eb !important;
      }

      /* Reset button must ALWAYS be visible */
      .no-theme {
        all: unset !important;
        box-sizing: border-box !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background-color: #000000 !important;
        color: #ffffff !important;
        border: 3px solid #000000 !important;
        padding: 8px 24px !important;
        border-radius: 12px !important;
        font-family: sans-serif !important;
        font-weight: 900 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.1em !important;
        font-size: 11px !important;
        cursor: pointer !important;
        transition: transform 0.2s ease !important;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
      }
      .no-theme:hover {
        transform: scale(1.05) !important;
        background-color: #1a1a1a !important;
      }
    `}} />
  );
}
