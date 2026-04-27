import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
const THUMBNAILS_DIR = path.join(__dirname, "../../uploads/thumbnails");

/**
 * TODO: Generate thumbnail for uploaded image
 *
 * Requirements:
 * 1. Construct input path: uploads/{filename}
 * 2. Create thumbnail name: "thumb-{filename}.jpg" (always .jpg extension)
 *    Example: "1704067200000-abc123.png" → "thumb-1704067200000-abc123.jpg"
 * 3. Construct output path: uploads/thumbnails/{thumbnailName}
 * 4. Use sharp to resize image:
 *    - Max dimensions: 200x200
 *    - fit: 'inside' (maintain aspect ratio)
 *    - withoutEnlargement: true (don't make small images larger)
 * 5. Convert to JPEG with quality 80
 * 6. Save to output path
 * 7. Return thumbnail filename
 *
 * @param {string} filename - Original filename (e.g., "1704067200000-abc123.jpg")
 * @returns {Promise<string>} - Thumbnail filename (e.g., "thumb-1704067200000-abc123.jpg")
 *
 * Hints:
 * - Use path.join() to construct file paths
 * - Use sharp(inputPath).resize(...).jpeg(...).toFile(outputPath)
 * - Replace file extension: filename.replace(/\.\w+$/, '.jpg')
 *
 * Example:
 * const thumb = await generateThumbnail('1704067200000-abc123.png');
 * // Returns: 'thumb-1704067200000-abc123.jpg'
 * // Creates: uploads/thumbnails/thumb-1704067200000-abc123.jpg
 */
export async function generateThumbnail(filename) {
    const inputPath = path.join(UPLOADS_DIR, filename);

    const baseName = filename.replace(/\.\w+$/, "");
    const thumbnailName = `thumb-${baseName}.jpg`;

    const outputPath = path.join(THUMBNAILS_DIR, thumbnailName);

    const meta = await sharp(inputPath).metadata();
    if (meta.width <= 200 && meta.height <= 200) {
        await fs.promises.copyFile(inputPath, outputPath);
        return thumbnailName;
    }

    await sharp(inputPath)
        .resize(200, 200, {
            fit: "inside",
            withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toFile(outputPath);

    return thumbnailName;
}

/**
 * TODO: Get image dimensions
 *
 * Requirements:
 * 1. Use sharp to read image metadata
 * 2. Extract width and height from metadata
 * 3. Return as object: { width: number, height: number }
 *
 * @param {string} filepath - Full path to image file
 * @returns {Promise<{width: number, height: number}>}
 *
 * Hints:
 * - Use sharp(filepath).metadata() to get metadata
 * - Metadata object contains width and height properties
 *
 * Example:
 * const dims = await getImageDimensions('/path/to/image.jpg');
 * // Returns: { width: 1920, height: 1080 }
 */
export async function getImageDimensions(filepath) {
    const data = await sharp(filepath).metadata();

    return {
        width: data.width,
        height: data.height,
    };
}
