import imageCompression from 'browser-image-compression';
import { supabase } from '../supabase';

export interface OptimizeOptions {
  maxWidthOrHeight?: number;
  maxSizeMB?: number;
  quality?: number;
  fileType?: string;
  preserveTransparency?: boolean;
}

export interface UploadResult {
  url: string;
  isBase64: boolean;
  originalSizeKB: number;
  compressedSizeKB: number;
  savedPercent: number;
}

/**
 * Compresses and resizes an image on the client side before uploading
 */
export async function optimizeImage(
  file: File,
  options: OptimizeOptions = {}
): Promise<{ file: File; dataUrl: string; originalSizeKB: number; compressedSizeKB: number }> {
  const originalSizeKB = Math.round(file.size / 1024);
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

  // SVGs are already vector and lightweight; if small, keep as is
  if (isSvg && file.size < 200 * 1024) {
    const dataUrl = await fileToDataUrl(file);
    return { file, dataUrl, originalSizeKB, compressedSizeKB: originalSizeKB };
  }

  const maxWidthOrHeight = options.maxWidthOrHeight || (options.preserveTransparency && isPng ? 500 : 600);
  const maxSizeMB = options.maxSizeMB || 0.25; // Default max 250KB

  try {
    // 1. Try using browser-image-compression for optimal web worker compression
    const compressionConfig = {
      maxSizeMB: maxSizeMB,
      maxWidthOrHeight: maxWidthOrHeight,
      useWebWorker: true,
      fileType: options.preserveTransparency && isPng ? 'image/png' : (options.fileType || 'image/jpeg'),
      initialQuality: options.quality || 0.82
    };

    const compressedBlob = await imageCompression(file, compressionConfig);
    const compressedFile = new File([compressedBlob], file.name.replace(/\.[^.]+$/, isPng && options.preserveTransparency ? '.png' : '.jpg'), {
      type: compressedBlob.type
    });

    const compressedSizeKB = Math.round(compressedFile.size / 1024);
    const dataUrl = await fileToDataUrl(compressedFile);

    console.info(`[ImageOptimizer] Optimized ${file.name}: ${originalSizeKB}KB -> ${compressedSizeKB}KB (${Math.round((1 - compressedSizeKB / Math.max(1, originalSizeKB)) * 100)}% saved)`);

    return {
      file: compressedFile,
      dataUrl,
      originalSizeKB,
      compressedSizeKB
    };
  } catch (err) {
    console.warn('[ImageOptimizer] browser-image-compression failed, falling back to Canvas:', err);
    // 2. Canvas fallback
    return await compressWithCanvas(file, maxWidthOrHeight, options.quality || 0.82, options.preserveTransparency && isPng);
  }
}

/**
 * Fallback Canvas-based compressor
 */
function compressWithCanvas(
  file: File,
  maxDimension: number,
  quality: number,
  preservePng: boolean
): Promise<{ file: File; dataUrl: string; originalSizeKB: number; compressedSizeKB: number }> {
  const originalSizeKB = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawUrl = e.target?.result as string;
          resolve({ file, dataUrl: rawUrl, originalSizeKB, compressedSizeKB: originalSizeKB });
          return;
        }

        // Draw image smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = preservePng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({ file, dataUrl, originalSizeKB, compressedSizeKB: originalSizeKB });
              return;
            }
            const outExt = preservePng ? '.png' : '.jpg';
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, outExt), { type: mimeType });
            const compressedSizeKB = Math.round(compressedFile.size / 1024);
            resolve({
              file: compressedFile,
              dataUrl,
              originalSizeKB,
              compressedSizeKB
            });
          },
          mimeType,
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes an image and uploads it to Supabase Storage with graceful fallback
 */
export async function uploadOptimizedImage(
  file: File,
  options: {
    primaryBucket: string;
    fallbackBuckets?: string[];
    filePath: string;
    maxWidthOrHeight?: number;
    maxSizeMB?: number;
    preserveTransparency?: boolean;
  }
): Promise<UploadResult> {
  // Step 1: Optimize and compress client-side
  const { file: compressedFile, dataUrl, originalSizeKB, compressedSizeKB } = await optimizeImage(file, {
    maxWidthOrHeight: options.maxWidthOrHeight,
    maxSizeMB: options.maxSizeMB,
    preserveTransparency: options.preserveTransparency
  });

  const buckets = [options.primaryBucket, ...(options.fallbackBuckets || ['madrasah-assets', 'member_photo', 'voice-templates'])];
  const uniqueBuckets = Array.from(new Set(buckets));

  let finalUrl: string | null = null;

  // Step 2: Try uploading to Supabase Storage buckets
  for (const bucket of uniqueBuckets) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(options.filePath, compressedFile, {
          cacheControl: '31536000', // 1 year cache
          upsert: true
        });

      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(options.filePath);
        if (data?.publicUrl) {
          finalUrl = data.publicUrl;
          break;
        }
      }
    } catch (err) {
      // Continue to next bucket
    }
  }

  const savedPercent = Math.max(0, Math.round((1 - compressedSizeKB / Math.max(1, originalSizeKB)) * 100));

  // Step 3: Fallback to ultra-compressed Base64 Data URL if storage buckets are unavailable
  if (!finalUrl) {
    return {
      url: dataUrl,
      isBase64: true,
      originalSizeKB,
      compressedSizeKB,
      savedPercent
    };
  }

  return {
    url: finalUrl,
    isBase64: false,
    originalSizeKB,
    compressedSizeKB,
    savedPercent
  };
}
