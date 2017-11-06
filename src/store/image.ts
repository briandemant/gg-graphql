import { Model } from "./model"
import { CacheUtil, makeCache } from "./cacheutil"


export function toImageUrl(id: number, size: ImageSizeType) {
	return `https://images.guloggratis.dk/${id % 100}/${id}_${ImageSizes[size]}_${ImageSizes[size]}_0_0_0_0_0.jpg`
}

const sizes = [[600, 400], [768, 1024], [3300, 3300], [333, 2222], [145, 145]]

function fakeImage(id: number): Image {
	// let between = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
	const size = sizes.shift() as number[]
	sizes.push(size)
	return {
		id,
		version: 0,
		url: toImageUrl(id, "ORIGINAL"),
		size: "ORIGINAL",
		width:  ImageSizes[ "ORIGINAL"], height:  ImageSizes[ "ORIGINAL"],
		// width: 0, height: 0,
		// width: size[0], height: size[1],
	}
}

async function scaleImage(image: Image, size: ImageSizeType): Promise<Image> {
	const maxPixels = ImageSizes[size]
	let width, height

	if ((image.width > maxPixels || image.height > maxPixels) && size !== "ORIGINAL") {
		const ratio = image.width / image.height
		if (ratio > 1) {
			width = maxPixels
			height = maxPixels / ratio | 0
		} else {
			width = maxPixels * ratio | 0
			height = maxPixels
		}
	} else {
		width = image.width
		height = image.height
	}

	return {
		...image,
		url: toImageUrl(image.id, size),
		size,
		width,
		height,
	}
}

async function refreshItemFn(image: Image | number, ageInSeconds: number): Promise<Image | null> {

	if (typeof  image === "number") return fakeImage(image)
	if (ageInSeconds > 5) return fakeImage(image.id)

	return null
}

let cache: CacheUtil<Image>
(async () => {
	cache = await makeCache<Image>("image", refreshItemFn, 60 * 60 * 24 * 365)
})()

export interface Image extends Model {
	readonly id: number
	readonly version: number
	readonly size: ImageSizeType
	readonly url: string
	readonly width: number
	readonly height: number
}

export type ImageSizeType = "ORIGINAL" | "HUGE" | "BIG" | "NORMAL" | "SMALL"
export const ImageSizes = {
	"ORIGINAL": 2400,
	"HUGE": 1200,
	"BIG": 600,
	"NORMAL": 300,
	"SMALL": 150,
}

export class ImageRepo {
	static async find(id: number, size: ImageSizeType): Promise<Image | null> {
		console.log("SIZE", size)
		if (!size) {
			size = "NORMAL"
		}

		const image = await cache.get(id)

		if (!image) return null

		return scaleImage(image, size)
	}

	static saveToCache(image: Image): void {
		cache.update(image)
	}
}