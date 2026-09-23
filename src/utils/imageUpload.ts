import { uploadOptimizedImage } from './imageOptimizer';

export const compressAndUploadMemberPhoto = async (
  file: File,
  institutionId: string,
  memberId: string
): Promise<string | null> => {
  try {
    const fileName = `${memberId}_${Date.now()}.jpg`;
    const filePath = `${institutionId}/${fileName}`;

    const result = await uploadOptimizedImage(file, {
      primaryBucket: 'member_photo',
      fallbackBuckets: ['madrasah-assets', 'voice-templates'],
      filePath: filePath,
      maxWidthOrHeight: 500,
      maxSizeMB: 0.15, // Ultra-compact: ~150KB max
      preserveTransparency: false
    });

    return result.url;
  } catch (error) {
    console.error('Image compression or upload failed:', error);
    return null;
  }
};
