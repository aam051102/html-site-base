"use strict";

const through = require("through2");
const PluginError = require("plugin-error");
const htmlParser = require("node-html-parser");
const readChunk = require("read-chunk");
const imageType = require("image-type");
const path = require("path");
const webp = require("webp-converter");

const PLUGIN_NAME = "gulp-picture";

webp.grant_permission();

function render(data, options = {}) {
    return through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            return callback(null, file);
        }

        if (file.isStream()) {
            callback(new PluginError(PLUGIN_NAME, "Streaming not supported"));
        }

        options.filename = file.path;

        const optionData = Object.assign({}, data, file.data);

        try {
            /* Render start */
            let parsed = htmlParser.parse(file.contents.toString());

            parsed.querySelectorAll("img").forEach((img) => {
                const imgSrc = img.getAttribute("src");
                const src = path.resolve(
                    path.join(optionData.publicDir, imgSrc)
                );
                const type = imageType(readChunk.sync(src, 0, 12));

                if (!optionData.exclude.includes(type.mime)) {
                    /* Create alternative files */
                    let imageSources = "";
                    const srcBase = path.resolve(
                        path.join(
                            optionData.outputDir,
                            path.dirname(imgSrc),
                            path.basename(src, path.extname(src))
                        )
                    );

                    // WebP
                    if (optionData.webp) {
                        let webpSrc = srcBase + ".webp";

                        webp.cwebp(
                            src,
                            webpSrc,
                            `-q ${optionData.webpQuality || 80}`
                        );

                        imageSources += `<source srcset="${webpSrc}" type="image/webp" />`;
                    }

                    // JPEG 2000
                    if (optionData.jp2 && false) {
                        let jp2Src = srcBase + ".jp2";

                        imageSources += `<source srcset="${jp2Src}" type="image/jp2" />`;
                    }

                    // IE Fallback
                    if (optionData.ieFallback && false) {
                        let ieSrc = srcBase + ".jxr";

                        imageSources += `<img src="${ieSrc}" type="image/vnd.ms-photo" />`;
                    } else {
                        imageSources += `<img src="${src} type="${type.mime}" />`;
                    }

                    // Replace image with picture
                    img.parentNode.exchangeChild(
                        img,
                        htmlParser.parse(`<picture>${imageSources}</picture>`)
                    );
                }
            });

            let rendered = parsed.toString();
            /* Render end */

            if (options.async && typeof rendered.then === "function") {
                rendered
                    .then((rendered) => {
                        file.contents = Buffer.from(rendered);
                        this.push(file);
                    })
                    .catch((err) => {
                        this.emit(
                            "error",
                            new PluginError(PLUGIN_NAME, err, {
                                fileName: file.path,
                            })
                        );
                    })
                    .then(callback);

                return;
            }

            file.contents = Buffer.from(rendered);
            this.push(file);
        } catch (err) {
            this.emit(
                "error",
                new PluginError(PLUGIN_NAME, err, { fileName: file.path })
            );
        }

        callback();
    });
}

module.exports = render;
