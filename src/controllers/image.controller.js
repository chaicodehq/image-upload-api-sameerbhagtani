import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Image } from "../models/image.model.js";
import { generateThumbnail, getImageDimensions } from "../utils/thumbnail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../../uploads");

/**
 * TODO: Upload image
 *
 * 1. Check if file uploaded (if !req.file, return 400 "No file uploaded")
 * 2. Get file info from req.file (filename, originalname, mimetype, size)
 * 3. Get image dimensions using getImageDimensions(filepath)
 * 4. Generate thumbnail using generateThumbnail(filename)
 * 5. Extract optional fields from req.body (description, tags)
 *    - Parse tags: split by comma and trim each tag
 * 6. Save metadata to database (Image.create)
 * 7. Return 201 with image metadata
 */
export async function uploadImage(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: {
                    message: "No file uploaded",
                },
            });
        }

        const { filename, originalname, mimetype, size, path } = req.file;
        const dimensions = await getImageDimensions(path);
        const thumbnailFilename = await generateThumbnail(filename);

        const { description, tags } = req.body;
        let tagsArr = [];

        if (tags) {
            tagsArr = tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean);
        }

        const image = await Image.create({
            originalName: originalname,
            filename,
            mimetype,
            size,
            width: dimensions.width,
            height: dimensions.height,
            thumbnailFilename,
            description,
            tags: tagsArr,
        });

        return res.status(201).json(image);
    } catch (error) {
        next(error);
    }
}

/**
 * TODO: List images with pagination and filtering
 *
 * 1. Extract query parameters:
 *    - page (default 1)
 *    - limit (default 10, max 50)
 *    - search (search in originalName and description)
 *    - mimetype (filter by mimetype)
 *    - sortBy (field to sort by, default 'uploadDate')
 *    - sortOrder (asc or desc, default 'desc')
 *
 * 2. Build MongoDB query:
 *    - Add text search if search parameter provided
 *    - Add mimetype filter if provided
 *
 * 3. Calculate pagination:
 *    - skip = (page - 1) * limit
 *    - total = await Image.countDocuments(query)
 *    - pages = Math.ceil(total / limit)
 *
 * 4. Fetch images with sorting and pagination:
 *    - Image.find(query).sort({[sortBy]: sortOrder === 'asc' ? 1 : -1}).skip(skip).limit(limit)
 *
 * 5. Calculate totalSize (sum of all image sizes)
 *
 * 6. Return 200 with:
 *    - data: images array
 *    - meta: { total, page, limit, pages, totalSize }
 */
export async function listImages(req, res, next) {
    try {
        let {
            page = 1,
            limit = 10,
            search,
            mimetype,
            sortBy = "uploadDate",
            sortOrder = "desc",
        } = req.query;

        page = Number(page);
        limit = Math.min(Number(limit), 50);

        const skip = (page - 1) * limit;

        const filter = {};

        if (search) {
            filter.$or = [
                { originalName: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
            ];
        }

        if (mimetype) {
            filter.mimetype = mimetype;
        }

        const total = await Image.countDocuments(filter);

        const images = await Image.find(filter)
            .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(limit);

        const totalSize = images.reduce((total, image) => {
            return total + image.size;
        }, 0);

        return res.status(200).json({
            data: images,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
                totalSize,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * TODO: Get image metadata by ID
 *
 * 1. Find image by req.params.id
 * 2. If not found: return 404 "Image not found"
 * 3. Return 200 with image metadata
 */
export async function getImage(req, res, next) {
    try {
        const image = await Image.findById(req.params.id);

        if (!image) {
            return res.status(404).json({
                error: {
                    message: "Image not found",
                },
            });
        }

        return res.status(200).json(image);
    } catch (error) {
        next(error);
    }
}

/**
 * TODO: Download original image
 *
 * 1. Find image by req.params.id
 * 2. If not found: return 404 "Image not found"
 * 3. Construct file path
 * 4. Check if file exists using fs.existsSync()
 * 5. If file missing: return 404 "File not found"
 * 6. Set headers:
 *    - Content-Type: image.mimetype
 *    - Content-Disposition: attachment; filename="originalName"
 * 7. Send file using res.sendFile(filepath)
 */
export async function downloadImage(req, res, next) {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({
                error: {
                    message: "Image not found",
                },
            });
        }

        const filePath = path.join(UPLOADS_DIR, image.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: {
                    message: "Image not found",
                },
            });
        }

        res.set({
            "Content-Type": image.mimetype,
            "Content-Disposition": `attachment; filename=${image.originalName}`,
        });

        return res.sendFile(filePath);
    } catch (error) {
        next(error);
    }
}

/**
 * TODO: Download thumbnail
 *
 * 1. Find image by req.params.id
 * 2. If not found: return 404 "Image not found"
 * 3. Construct thumbnail path
 * 4. Check if thumbnail exists
 * 5. If missing: return 404 "File not found"
 * 6. Set headers:
 *    - Content-Type: image/jpeg (thumbnails are always JPEG)
 * 7. Send file using res.sendFile(thumbnailPath)
 */
export async function downloadThumbnail(req, res, next) {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({
                error: {
                    message: "Image not found",
                },
            });
        }

        const baseName = image.filename.replace(/\.\w+$/, "");
        const thumbnailName = `thumb-${baseName}.jpg`;

        const filePath = path.join(UPLOADS_DIR, "thumbnails", thumbnailName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: {
                    message: "Image not found",
                },
            });
        }

        res.set({
            "Content-Type": "image/jpeg",
        });

        return res.sendFile(filePath);
    } catch (error) {
        next(error);
    }
}

/**
 * TODO: Delete image
 *
 * 1. Find image by req.params.id
 * 2. If not found: return 404 "Image not found"
 * 3. Delete original file (use try-catch, ignore ENOENT errors)
 * 4. Delete thumbnail (use try-catch, ignore ENOENT errors)
 * 5. Delete metadata from database
 * 6. Return 204 (no content)
 */
export async function deleteImage(req, res, next) {
    try {
        const image = await Image.findById(req.params.id);

        if (!image) {
            return res.status(404).json({
                error: {
                    message: "Image not found",
                },
            });
        }

        try {
            await fs.promises.unlink(path.join(UPLOADS_DIR, image.filename));
        } catch (err) {
            if (err.code !== "ENOENT") throw err;
        }

        try {
            await fs.promises.unlink(
                path.join(UPLOADS_DIR, "thumbnails", image.thumbnailFilename),
            );
        } catch (err) {
            if (err.code !== "ENOENT") throw err;
        }

        await image.deleteOne();

        return res.sendStatus(204);
    } catch (error) {
        next(error);
    }
}
