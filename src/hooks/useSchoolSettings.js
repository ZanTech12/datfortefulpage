import { useQuery } from '@tanstack/react-query';
import { siteInfoAPI } from '../services/api';

// ✅ Base URL for constructing media URLs (uploads)
export const API_BASE_URL = 'http://localhost:5000';

// ✅ Deep-scan any shape (string | {url} | {filename} | nested) for a usable URL
const findUrlInValue = (value, depth = 0) => {
  if (value == null || depth > 4) return null;

  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return null;
    // Absolute / root-relative URL
    if (/^(https?:)?\/\//i.test(v) || v.startsWith('/')) return v;
    // Bare filename with an image extension (e.g. "schoolLogo-123.png")
    if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(v)) return v;
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrlInValue(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    // Check likely keys first
    const priorityKeys = ['url', 'secure_url', 'location', 'path', 'src', 'file', 'filename', 'filePath', 'fullPath'];
    for (const key of priorityKeys) {
      if (value[key] != null) {
        const found = findUrlInValue(value[key], depth + 1);
        if (found) return found;
      }
    }
    // Last resort: scan everything
    for (const val of Object.values(value)) {
      const found = findUrlInValue(val, depth + 1);
      if (found) return found;
    }
  }

  return null;
};

// ✅ Convert whatever was found into a fetchable absolute URL
export const buildMediaUrl = (media) => {
  const raw = findUrlInValue(media);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  return `${API_BASE_URL}/${raw}`;
};

// ✅ First non-empty match from a list of candidate field names
const pickField = (d, names) => {
  for (const n of names) {
    if (d[n] != null && d[n] !== '') return d[n];
  }
  return null;
};

// ✅ Normalize the site-information payload into display fields
export const normalizeSchoolSettings = (res) => {
  const d = res?.data || res || {};

  // 🔍 DEBUG: check the browser console to see the exact shape the API returns.
  // Remove this line once logo/signature are confirmed working.
  console.log('[useSchoolSettings] raw site info:', d);

  return {
    name: d.schoolName || d.name || '',
    shortName: d.shortName || '',
    motto: d.schoolMotto || d.motto || '',
    address: [d.address, d.state, d.country].filter(Boolean).join(', '),
    email: d.email || '',
    website: d.website || '',
    phone: d.phoneNumber || '',
    principalName: d.principalName || '',
    logoUrl: buildMediaUrl(pickField(d, ['schoolLogo', 'logo', 'logoUrl', 'school_logo', 'logoPath', 'logo_url'])),
    signatureUrl: buildMediaUrl(pickField(d, ['principalSignature', 'signature', 'signatureUrl', 'principal_signature', 'principalSignatureUrl', 'signature_url'])),
  };
};

// ✅ Shared hook — one fetch per session (5-min cache, shared query key)
export const useSchoolSettings = () => {
  const { data } = useQuery({
    queryKey: ['site-information'],
    queryFn: siteInfoAPI.getSiteInfo,
    staleTime: 300000,
    retry: 0,
  });
  return normalizeSchoolSettings(data);
};