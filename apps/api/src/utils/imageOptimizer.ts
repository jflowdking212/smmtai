import sharp from 'sharp';
import { resolve, extname } from 'path';
import { writeFile, mkdir } from 'fs/promises';

interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

const SUPPORTED_FORMATS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.avif']);

export async function optimizeImage(
  inputBuffer: Buffer,
  filename: string,
  options: OptimizeOptions = {},
): Promise<{ buffer: Buffer; filename: string; mimetype: string; width: number; height: number }> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 80, format } = options;
  const ext = extname(filename).toLowerCase();

  if (!SUPPORTED_FORMATS.has(ext)) {
    return {
      buffer: inputBuffer,
      filename,
      mimetype: `image/${ext.slice(1)}`,
      width: 0,
      height: 0,
    };
  }

  let pipeline = sharp(inputBuffer)
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
    .rotate(); // auto-rotate based on EXIF

  const outputFormat = format || (ext === '.png' ? 'png' : 'webp');
  const outputExt = `.${outputFormat}`;
  const outputFilename = filename.replace(/\.[^.]+$/, outputExt);

  switch (outputFormat) {
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 8 });
      break;
  }

  const result = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    filename: outputFilename,
    mimetype: `image/${outputFormat}`,
    width: result.info.width,
    height: result.info.height,
  };
}

export async function generateThumbnail(
  inputBuffer: Buffer,
  size = 300,
): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(size, size, { fit: 'cover' })
    .webp({ quality: 70 })
    .toBuffer();
}

export async function saveOptimizedImage(
  inputBuffer: Buffer,
  filename: string,
  uploadDir: string,
  options?: OptimizeOptions,
): Promise<{ path: string; thumbPath: string; width: number; height: number }> {
  const dir = resolve(uploadDir);
  const thumbDir = resolve(dir, 'thumbnails');
  await mkdir(dir, { recursive: true });
  await mkdir(thumbDir, { recursive: true });

  const optimized = await optimizeImage(inputBuffer, filename, options);
  const thumb = await generateThumbnail(inputBuffer);

  const filePath = resolve(dir, optimized.filename);
  const thumbPath = resolve(thumbDir, optimized.filename);

  await writeFile(filePath, optimized.buffer);
  await writeFile(thumbPath, thumb);

  return {
    path: optimized.filename,
    thumbPath: `thumbnails/${optimized.filename}`,
    width: optimized.width,
    height: optimized.height,
  };
}
