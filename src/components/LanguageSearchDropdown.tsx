'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, X } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

export default function LanguageSearchDropdown() {
  const { language, setLanguage, availableLanguages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentLang = availableLanguages.find(l => l.code === language) || availableLanguages[0];

  const filteredLanguages = availableLanguages.filter(lang => 
    lang.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="language-dropdown-wrapper" style={{ position: 'relative' }} ref={dropdownRef}>
      {/* IMPROVED ICON TRIGGER */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '30px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          boxShadow: isOpen ? '0 0 15px rgba(99, 91, 255, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
          transition: 'border-color 0.3s, box-shadow 0.3s',
          borderColor: isOpen ? 'rgba(99, 91, 255, 0.5)' : 'rgba(255, 255, 255, 0.15)'
        }}
        aria-label="Change Language"
      >
        <Globe size={18} style={{ opacity: 0.9 }} />
        <span style={{ 
          fontSize: '13px', 
          fontWeight: '600', 
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          opacity: 0.9
        }}>
          {currentLang.code}
        </span>
      </motion.button>

      {/* DROPDOWN MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: '280px',
              maxHeight: '420px',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Search Input */}
            <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search language..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    outline: 'none',
                    color: '#1e293b',
                    background: '#f8fafc',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#635bff';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 91, 255, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }} className="custom-scrollbar">
              {filteredLanguages.length > 0 ? (
                filteredLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: '12px',
                      border: 'none',
                      background: language === lang.code ? '#f1f5f9' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.2s, transform 0.1s',
                      gap: '2px'
                    }}
                    onMouseOver={(e) => {
                      if (language !== lang.code) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseOut={(e) => {
                      if (language !== lang.code) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ 
                      color: language === lang.code ? '#635bff' : '#1e293b', 
                      fontWeight: '700', 
                      fontSize: '15px' 
                    }}>
                      {lang.nativeName}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>
                      {lang.englishName}
                    </span>
                  </button>
                ))
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  No languages found for "{searchQuery}"
                </div>
              )}
            </div>
            
            <style jsx>{`
              .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #e2e8f0;
                border-radius: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #cbd5e1;
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
