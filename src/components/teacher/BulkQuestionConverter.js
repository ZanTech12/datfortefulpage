import React, { useState } from 'react';
// ✅ Import the safe copy package
import copy from 'copy-to-clipboard';
import { adminAPI } from '../../api';

const BulkQuestionConverter = () => {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleConvert = async () => {
    if (!rawText.trim()) {
      setError('Please paste some questions first.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await adminAPI.convertQuestions(rawText);
      if (res?.success) {
        setResult(res.data);
      } else {
        setError(res?.message || 'Conversion failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = result ? JSON.stringify(result, null, 2) : 'No data to copy';
    
    // ✅ DEPENDENCY: Automatically handles all mobile/insecure context fallbacks
    copy(text);

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Responsive Styles */}
      <style>{`
        .bqc-container {
          max-width: 900px;
          margin: 0 auto;
          background-color: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          font-family: system-ui, sans-serif;
        }
        .bqc-header {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.5rem;
        }
        .bqc-subheader {
          color: #64748b;
          font-size: 0.9rem;
          margin-bottom: 2rem;
          line-height: 1.5;
        }
        .bqc-field {
          margin-bottom: 1.5rem;
        }
        .bqc-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          color: #334155;
          margin-bottom: 0.5rem;
        }
        .bqc-textarea {
          width: 100%;
          min-height: 220px;
          padding: 1rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          box-sizing: border-box;
          font-family: monospace;
          transition: border-color 0.2s;
          line-height: 1.5;
        }
        .bqc-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .bqc-btn {
          padding: 0.85rem 1.5rem;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          transition: background-color 0.2s;
        }
        .bqc-btn:hover { background-color: #1d4ed8; }
        .bqc-btn:disabled { background-color: #93c5fd; cursor: not-allowed; }
        
        .bqc-alert {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          background-color: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .bqc-result-box {
          margin-top: 2rem;
          padding: 1.5rem;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          position: relative;
        }
        .bqc-copy-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 6px 12px;
          background-color: #e5e7eb;
          color: #334155;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s;
          z-index: 1;
        }
        .bqc-copy-btn:hover { background-color: #cbd5e1; }
        .bqc-pre {
          white-space: pre-wrap;
          word-break: break-word; /* Prevents horizontal scroll on mobile */
          color: #1e293b;
          margin: 0;
          font-size: 0.85rem;
          line-height: 1.6;
        }

        /* ===== MOBILE VIEW ===== */
        @media (max-width: 640px) {
          .bqc-container {
            padding: 1.25rem;
            border-radius: 0;
            border: none;
            box-shadow: none;
            background-color: transparent;
            max-width: 100%;
          }
          .bqc-header {
            font-size: 1.25rem;
          }
          .bqc-subheader {
            font-size: 0.85rem;
            margin-bottom: 1.5rem;
          }
          .bqc-textarea {
            min-height: 260px;
            font-size: 0.9rem;
            padding: 0.75rem;
          }
          .bqc-btn {
            padding: 0.9rem 1.5rem;
            font-size: 0.95rem;
          }
          .bqc-result-box {
            padding: 1rem;
            padding-top: 2.75rem; /* Extra top space so text doesn't overlap copy button */
            margin-top: 1.5rem;
          }
          .bqc-pre {
            font-size: 0.8rem;
          }
          .bqc-copy-btn {
            top: 8px;
            right: 8px;
            padding: 5px 10px;
          }
        }
      `}</style>

      <div className="bqc-container">
        <h1 className="bqc-header">Bulk Question Converter (AI)</h1>
        <p className="bqc-subheader">
          Paste raw questions (from PDFs, images, or text) below. Google Gemini will convert them into the structured JSON format.
        </p>

        {error && <div className="bqc-alert">{error}</div>}

        <div className="bqc-field">
          <label className="bqc-label">Raw Questions Text</label>
          <textarea
            className="bqc-textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="e.g. 1. What is the capital of France? A) London B) Paris C) Berlin D) Madrid. Answer: B"
            disabled={loading}
          />
        </div>

        <button className="bqc-btn" onClick={handleConvert} disabled={loading}>
          {loading ? 'Converting with AI...' : 'Convert to JSON'}
        </button>

        {result && (
          <div className="bqc-result-box">
            <button className="bqc-copy-btn" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy JSON'}
            </button>
            <pre className="bqc-pre">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </>
  );
};

export default BulkQuestionConverter;