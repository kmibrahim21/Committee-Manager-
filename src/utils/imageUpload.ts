
import imageCompression from 'browser-image-compression';
import { supabase } from '../supabase';

export const compressAndUploadMemberPhoto = async (
  file: File,
  institutionId: string,
  memberId: string
): Promise<string | null> => {
  try {
    // 1. Compression options
    const options = {
      maxSizeMB: 0.5, // Max size 500KB
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };

    // 2. Compress the image
    const compressedFile = await imageCompression(file, options);

    // 3. Generate a unique file path
    const fileExt = 'jpg';
    const fileName = `${memberId}_${Date.now()}.${fileExt}`;
    const filePath = `${institutionId}/${fileName}`;

    // 4. Upload to Supabase Bucket 'member_photo'
    const { data, error } = await supabase.storage
      .from('member_photo')
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }

    // 5. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('member_photo')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Image compression or upload failed:', error);
    return null;
  }
};
