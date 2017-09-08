var request = require("request"),
	adblock = require("./lib/adblock.js"),
	urlObj = require("url"),
	cheerio = require("cheerio");


function getPreview(urlObj, callback) {
	var url, proxy, debug, headers;

	if(typeof(urlObj) === "object") {
		url = urlObj.url;
		proxy = urlObj.proxy;
		debug = urlObj.debug;
		headers = urlObj.headers || {};
	} else {
		url = urlObj;
	}


	var youtubeIdRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w]+)/;
	var youtubeMatch = url.match(youtubeIdRegex);
	if (youtubeMatch) {
		var youtubeId = youtubeMatch[1];
		var API_KEY = process.env.YOUTUBE_API_KEY
		var REFERER = process.env.YOUTUBE_REFERER
		if (typeof API_KEY === 'undefined' || API_KEY === null || API_KEY === '') {
			callback({
				error: {
					message: 'Environment variable YOUTUBE_API_KEY must be set!',
					error: 'YOUTUBE_API_KEY is null',
					responseStatusCode: 500
				}}, createResponseData(url, true));
			return;
		} else if (typeof REFERER === 'undefined' || REFERER === null || REFERER === '') {
			callback({
				error: {
					message: 'Environment variable YOUTUBE_REFERER must be set!',
					error: 'YOUTUBE_REFERER is null',
					responseStatusCode: 500
				}}, createResponseData(url, true));
			return;
		} else {
			url = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + encodeURIComponent(youtubeId) + "&key=" + encodeURIComponent(API_KEY);
			headers.Referer = REFERER;
			console.log('Invoking url: ' + url + ' - with headers:', headers);
		}
	}

	var req = request( {
		uri: url,
		proxy: proxy,
		timeout: 10000,
		headers: headers
	}, function(err, response, body) {
		// ability to debug raw responses...
		if (debug) {
			if (err) {
				console.log(err);
			} else {
				console.log(response);
			}
		}
		if(!err && response && response.statusCode === 200 && body) {
			if (youtubeMatch) {
				var jsonbody = JSON.parse(body);
				callback(null, {
					"url": url,
					"loadFailed": false,
					"title": jsonbody.items[0].snippet.title,
					"description": jsonbody.items[0].snippet.description,
					"contentType": "text/html",
					"mediaType": "website",
					"images": [
						jsonbody.items[0].snippet.thumbnails.default.url,
						jsonbody.items[0].snippet.thumbnails.medium.url,
						jsonbody.items[0].snippet.thumbnails.high.url,
						jsonbody.items[0].snippet.thumbnails.standard.url,
						jsonbody.items[0].snippet.thumbnails.maxres.url,
					]
				});
				return;
			} else {
				callback(null, parseResponse(body, url));
			}
		} else if (err) {
			callback({
				error: {
					message: 'received an error response',
					error: err,
					responseStatusCode: (response ? response.statusCode : null)
				}}, createResponseData(url, true));
		} else if (!response || response.statusCode !== 200) {
			callback({
				error: {
					message: 'status code ' + (response ? response.statusCode : null) + ' did not match 200', 
					error: err,
					responseStatusCode: (response ? response.statusCode : null)
				}}, createResponseData(url, true));
		} else if (!body) {
			callback({
				error: {
					message: 'body was not present in the response', 
					error: err,
					responseStatusCode: (response ? response.statusCode : null)
				}}, createResponseData(url, true));
		}
	} );

	req.on("response", function(res) {
		var contentType = res.headers["content-type"];
		if(contentType) {
			var isHtml = contentType.indexOf("text/html") === 0;
			var isJson = contentType.indexOf("application/json") === 0;
			var isValid = youtubeMatch ? isJson : isHtml;
			if (!isValid) {
				req.abort();
				callback(null, parseMediaResponse(res, contentType, url) );
			}
		}
	});
}

function parseResponse(body, url) {
	var doc, 
		title, 
		description,
		mediaType,
		images,
		videos;

	doc = cheerio.load(body);
	title = getTitle(doc);

	description = getDescription(doc);

	mediaType = getMediaType(doc);

	images = getImages(doc, url);

	videos = getVideos(doc);

	return createResponseData(url, false, title, description, "text/html", mediaType, images, videos);
}

function getTitle(doc){
    var title = doc("title").text();

    if(title === undefined || !title){
        title = doc("meta[property='og:title']").attr("content");
    }

    return title;
}

function getDescription(doc){
    var description = doc("meta[name=description]").attr("content");

    if(description === undefined) {
        description = doc("meta[name=Description]").attr("content");

        if(description === undefined) {
            description = doc("meta[property='og:description']").attr("content");
        }
    }

    return description;
}

function getMediaType(doc) {
	var node = doc("meta[name=medium]"),
		content;

	if(node.length) {
		content = node.attr("content");
		return content == "image" ? "photo" : content;
	} else {
		return doc("meta[property='og:type']").attr("content");
	}
}

var minImageSize = 50;
function getImages(doc, pageUrl) {
	var images = [], nodes, src,
		width, height,
		dic;

	nodes = doc("meta[property='og:image']");

	if(nodes.length) {
		nodes.each(function(index, node){
            src = node.attribs["content"];
            if(src){
                src = urlObj.resolve(pageUrl, src);
                images.push(src);
            }
		});
	}

	if(images.length <= 0) {
		src = doc("link[rel=image_src]").attr("href");
		if(src) {
            src = urlObj.resolve(pageUrl, src);
            images = [ src ];
		} else {
			nodes = doc("img");

			if(nodes.length) {
				dic = {};
				images = [];
				nodes.each(function(index, node) {
					src = node.attribs["src"];
					if(src && !dic[src]) {
						dic[src] = 1;
						width = node.attribs["width"] || minImageSize;
						height = node.attribs["height"] || minImageSize;
						src = urlObj.resolve(pageUrl, src);
						if(width >= minImageSize && height >= minImageSize && !isAdUrl(src)) {
							images.push(src);
						}
					}
				});
			}
		}
	}
	return images;
}

function isAdUrl(url) {
	if(url) {
		return adblock.isAdUrl(url);
	} else {
		return false;
	}
}

function getVideos(doc) {
	var videos, 
		nodes, nodeTypes, nodeSecureUrls, 
		nodeType, nodeSecureUrl,
		video, videoType, videoSecureUrl,
		width, height,
		videoObj, index, length;

	nodes = doc("meta[property='og:video']");
	length =  nodes.length;
	if(length) {
		videos = [];
		nodeTypes = doc("meta[property='og:video:type']");
		nodeSecureUrls = doc("meta[property='og:video:secure_url']");
		width = doc("meta[property='og:video:width']").attr("content");
		height = doc("meta[property='og:video:height']").attr("content");
		
		for(index = 0; index < length; index++) {
			video = nodes[index].attribs["content"];
			
			nodeType = nodeTypes[index];
			videoType = nodeType ? nodeType.attribs["content"] : null;

			nodeSecureUrl = nodeSecureUrls[index];
			videoSecureUrl = nodeSecureUrl ? nodeSecureUrl.attribs["content"] : null;

			videoObj = { url: video, secureUrl: videoSecureUrl, type: videoType, width: width, height: height };
			if(videoType.indexOf("video/") === 0) {
				vidoes.splice(0, 0, videoObj);
			} else {
				videos.push(videoObj);
			}
		}
	}

	return videos;
}

function parseMediaResponse(res, contentType, url) {
	if(contentType.indexOf("image/") === 0) {
		return createResponseData(url, false, "", "", contentType, "photo", [url]);
	} else {
		return createResponseData(url, false, "", "", contentType);
	}
}

function createResponseData(url, loadFailed, title, description, contentType, mediaType, images, videos, audios) {
	return {
		url: url,
		loadFailed: loadFailed,
		title: title,
		description: description,
		contentType: contentType,
		mediaType: mediaType || "website",
		images: images,
		videos: videos,
		audios: audios
	};
}

module.exports = getPreview;
