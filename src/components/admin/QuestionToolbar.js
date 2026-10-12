// ============================================================
// src/components/admin/QuestionToolbar.js
// ------------------------------------------------------------
// Formatting toolbar for CBT question editors.
//
//   GROUP 1 (Text) : Bold · Italic · Underline
//   GROUP 2 (Math) : Superscript · Subscript
//   GROUP 3 (Image): File upload (auto-compressed) or by URL
//
// IMAGE TOKENS
//   Compressed images are stored in a shared figureStore and a
//   short token "[FIG:<id>]" is inserted into the textarea, so
//   the giant base64 string never clutters the editor.
//   The parent converts tokens ⇄ real <img> tags (see
//   htmlToDisplay / displayToHtml in QuestionSetManager).
// ============================================================

import React, { useRef, useState } from "react";
import { api } from "../../api";
import "./QuestionToolbar.css";

/* ============================================================
   1. CONFIG
   ============================================================ */
const CONFIG = {
  MAX_DIMENSION: 420,          // px — inline BMT-style figure size
  JPEG_QUALITY: 0.72,          // starting quality (auto-reduced if needed)
  TARGET_MAX_KB: 150,          // hard output cap — quality auto-degrades
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  UPLOAD_ENDPOINT: "/question-sets/upload-image",
  UPLOAD_FIELD: "image",
  ACCEPTED_TYPES: "image/png,image/jpeg,image/gif,image/webp",
};

/* ============================================================
   2. SHARED FIGURE STORE
   Maps token ids → compressed data-URLs.
   The parent reads this when converting tokens back to <img> tags.
   ============================================================ */
export const figureStore = new Map();

const newFigureId = () =>
  "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ============================================================
   3. PURE HELPERS
   ============================================================ */

/** Compress + resize to inline BMT figure size (≤420px, ≤150KB) */
const compressImage = (file) =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Only image files are allowed"));
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, CONFIG.MAX_DIMENSION / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        let quality = CONFIG.JPEG_QUALITY;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        let kb = Math.round((dataUrl.length * 0.75) / 1024);

        while (kb > CONFIG.TARGET_MAX_KB && quality > 0.3) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          kb = Math.round((dataUrl.length * 0.75) / 1024);
        }

        console.log(
          `🖼️ [QuestionToolbar] compressed: ${(file.size / 1024).toFixed(0)}KB → ${kb}KB ` +
          `(${w}×${h}, q${quality.toFixed(2)})`
        );
        resolve(dataUrl);
      };
      img.onerror = () => {
        console.error("🖼️ [QuestionToolbar] decode failed — unsupported format? (HEIC?)");
        reject(new Error("Could not decode that image — try a JPG or PNG screenshot"));
      };
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });

/** data-URL → File (for server-upload mode) */
const dataUrlToFile = (dataUrl, filename) => {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
};

/** Wrap a substring in a tag */
const wrapWithTag = (value, start, end, tag) => {
  const selected = value.slice(start, end) || "text";
  return {
    next: value.slice(0, start) + `<${tag}>${selected}</${tag}>` + value.slice(end),
    selStart: start + tag.length + 2,
    selEnd: start + tag.length + 2 + selected.length,
    selected,
  };
};

/* ============================================================
   4. COMPONENT
   ============================================================ */
const QuestionToolbar = ({
  textareaRef,       // optional fallback target
  onChange,          // (newDisplayText) => void  — receives TEXT WITH TOKENS
  value,             // current display text (with tokens)
  mode = "base64",   // "base64" | "server"
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  /* ---------- Target resolution (focus-first, ref fallback) ---------- */
  const resolveTextarea = () => {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement) return active;

    const viaRef = textareaRef?.current;
    if (viaRef) return viaRef;

    const modal = document.querySelector(".qs-modal");
    if (modal) {
      const ta = modal.querySelector("textarea");
      if (ta) return ta;
    }
    console.warn("🖼️ [QuestionToolbar] no textarea found to insert into");
    return null;
  };

  /* ---------- Text formatting ---------- */
  const applyTag = (tag) => {
    const el = resolveTextarea();
    if (!el) {
      setError("Click inside a question field first, then use the toolbar.");
      return;
    }
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    const { next, selStart, selEnd } = wrapWithTag(el.value, s, e, tag);

    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  /* ---------- Insertion ---------- */
  const insertAtCursor = (textToInsert) => {
    const el = resolveTextarea();
    if (!el) {
      setError("Click inside a question field first, then insert the image.");
      return;
    }
    const at = el.selectionStart ?? el.value.length;
    const next = el.value.slice(0, at) + textToInsert + el.value.slice(at);

    if (typeof onChange === "function") {
      onChange(next);
    } else {
      el.value = next;
    }
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at + textToInsert.length, at + textToInsert.length);
    });
  };

  /* ---------- Image: file → compress → store token ---------- */
  const handleFilePicked = async (file) => {
    if (!file) return;
    console.log(
      "🖼️ [QuestionToolbar] file picked:", file.name, file.type,
      (file.size / 1024).toFixed(0) + "KB"
    );

    setUploading(true);
    setError("");
    try {
      if (file.size > CONFIG.MAX_FILE_BYTES) {
        throw new Error("Image too large — max 10MB. Try a smaller screenshot.");
      }

      const dataUrl = await compressImage(file);

      if (mode === "server") {
        // Server mode: upload, insert /uploads/ URL directly (short anyway)
        const compressedFile = dataUrlToFile(dataUrl, `q-${Date.now()}.jpg`);
        const fd = new FormData();
        fd.append(CONFIG.UPLOAD_FIELD, compressedFile);

        const response = await api.post(CONFIG.UPLOAD_ENDPOINT, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const json = response.data;
        console.log("🖼️ [QuestionToolbar] upload response:", json);

        if (json.success) {
          insertAtCursor(` <img src="${json.url}" alt="figure" /> `);
        } else {
          setError(json.message || "Upload failed");
        }
      } else {
        // ✨ Base64 mode: store the image, insert a short token
        const id = newFigureId();
        figureStore.set(id, dataUrl);
        insertAtCursor(` [FIG:${id}] `);
      }
    } catch (err) {
      console.error("🖼️ [QuestionToolbar] FAILED:", err);
      setError(err.message || "Image processing failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ---------- Image: insert by URL ---------- */
  const handleInsertByUrl = () => {
    const url = window.prompt("Paste the image URL (https://… or /uploads/…):");
    if (!url) return;
    const trimmed = url.trim();
    if (!/^(https?:\/\/|\/uploads\/)/.test(trimmed)) {
      setError("URL must start with https:// or /uploads/");
      return;
    }
    insertAtCursor(` <img src="${trimmed}" alt="figure" style="max-width:100%;" /> `);
  };

  /* ---------- Button groups ---------- */
  const GROUPS = [
    {
      label: "Text",
      buttons: [
        { key: "b", label: <b>B</b>, tag: "b", title: "Bold" },
        { key: "i", label: <i>I</i>, tag: "i", title: "Italic" },
        { key: "u", label: <u>U</u>, tag: "u", title: "Underline" },
      ],
    },
    {
      label: "Math",
      buttons: [
        { key: "sup", label: "x²", tag: "sup", title: "Superscript" },
        { key: "sub", label: "x₂", tag: "sub", title: "Subscript" },
      ],
    },
    { label: "Image", buttons: [] },
  ];

  const Separator = () => <span className="qtb__sep" aria-hidden="true" />;

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="qtb">
      <div className="qtb__bar">
        {GROUPS.map((group, gi) => (
          <React.Fragment key={group.label}>
            {group.label === "Image" ? (
              <>
                <label
                  className={`qtb__btn qtb__btn--image ${uploading ? "qtb__btn--busy" : ""}`}
                  title="Insert math figure — auto-resized & compressed"
                >
                  {uploading ? (
                    <>
                      <span className="qtb__spinner" /> Uploading…
                    </>
                  ) : (
                    <>🖼️ Figure</>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={CONFIG.ACCEPTED_TYPES}
                    onChange={(e) => handleFilePicked(e.target.files?.[0])}
                  />
                </label>

                <button
                  type="button"
                  className="qtb__btn"
                  onClick={handleInsertByUrl}
                  title="Insert image by URL"
                >
                  🔗 URL
                </button>
              </>
            ) : (
              <div className="qtb__group" data-group={group.label}>
                {group.buttons.map(({ key, label, tag, title }) => (
                  <button
                    key={key}
                    type="button"
                    className="qtb__btn"
                    onClick={() => applyTag(tag)}
                    title={title}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {gi < GROUPS.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </div>

      {error && <p className="qtb__error">{error}</p>}
    </div>
  );
};

export default QuestionToolbar;