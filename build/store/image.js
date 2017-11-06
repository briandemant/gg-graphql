"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const cacheutil_1 = require("./cacheutil");
function toImageUrl(id, size) {
    return `https://images.guloggratis.dk/${id % 100}/${id}_${exports.ImageSizes[size]}_${exports.ImageSizes[size]}_0_0_0_0_0.jpg`;
}
exports.toImageUrl = toImageUrl;
const sizes = [[600, 400], [768, 1024], [3300, 3300], [333, 2222], [145, 145]];
function fakeImage(id) {
    // let between = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    const size = sizes.shift();
    sizes.push(size);
    return {
        id,
        version: 0,
        url: toImageUrl(id, "ORIGINAL"),
        size: "ORIGINAL",
        width: exports.ImageSizes["ORIGINAL"], height: exports.ImageSizes["ORIGINAL"],
    };
}
function scaleImage(image, size) {
    return __awaiter(this, void 0, void 0, function* () {
        const maxPixels = exports.ImageSizes[size];
        let width, height;
        if ((image.width > maxPixels || image.height > maxPixels) && size !== "ORIGINAL") {
            const ratio = image.width / image.height;
            if (ratio > 1) {
                width = maxPixels;
                height = maxPixels / ratio | 0;
            }
            else {
                width = maxPixels * ratio | 0;
                height = maxPixels;
            }
        }
        else {
            width = image.width;
            height = image.height;
        }
        return Object.assign({}, image, { url: toImageUrl(image.id, size), size,
            width,
            height });
    });
}
function refreshItemFn(image, ageInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof image === "number")
            return fakeImage(image);
        if (ageInSeconds > 5)
            return fakeImage(image.id);
        return null;
    });
}
let cache;
(() => __awaiter(this, void 0, void 0, function* () {
    cache = yield cacheutil_1.makeCache("image", refreshItemFn, 60 * 60 * 24 * 365);
}))();
exports.ImageSizes = {
    "ORIGINAL": 2400,
    "HUGE": 1200,
    "BIG": 600,
    "NORMAL": 300,
    "SMALL": 150,
};
class ImageRepo {
    static find(id, size) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("SIZE", size);
            if (!size) {
                size = "NORMAL";
            }
            const image = yield cache.get(id);
            if (!image)
                return null;
            return scaleImage(image, size);
        });
    }
    static saveToCache(image) {
        cache.update(image);
    }
}
exports.ImageRepo = ImageRepo;
//# sourceMappingURL=image.js.map