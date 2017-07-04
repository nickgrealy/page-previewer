var preview = require("./index.js"),
	assert = require("assert");

var input = [
	"http://www.cnn.com",
	"http://www.google.com",
	// "http://www.yahoo.com",
	// "https://new.myspace.com",
	// "http://www.huffingtonpost.com/2012/11/15/israel-troops-gaza_n_2139151.html",
	// "http://www.huffingtonpost.com/2012/11/15/petraeus-investigation_n_2140268.html",
	"http://www.huffingtonpost.com/2012/11/15/bp-criminal-settlement-gulf-spill_n_2140162.html",
	"http://health.yahoo.net/articles/nutrition/photos/12-fish-stay-away#0",
	"http://www.bbc.co.uk/news/world-middle-east-20349280",
	"http://www.bbc.co.uk/sport/0/football/20341219",
	"https://httpsnow.org/",
	"http://www.hollywoodreporter.com/sites/default/files/2012/10/penguin_books_random_house_a_l.jpg",
	"http://www.cricinfo.com",
	"http://www.satheeshnatesan.com",
	"http://www.theatlanticwire.com/entertainment/2012/12/new-music-genres-2012/59680/",
	"https://vimeo.com/183214201",
	"https://www.youtube.com/watch?v=Y5cSGxdDHz4&feature=relmfu",
	// "http://www.news.com.au/sport/motorsport/formula-one/sebastian-vettel-forced-to-admit-the-error-of-his-ways-in-baku/news-story/1e5c40adea952911a103d06d27c879b9"
];

input.forEach(function(val) {
	preview(val, function(err, data) {
		if(err) {
			assert.fail(err, null, "Unexpected error");
		} else {
			switch(val) {
				case "http://www.satheeshnatesan.com":
					assert.ok(data.loadFailed, "Bad url is not working. -- " + val);
					break;
				case "http://www.vimeo.com/33883554#":
				case "http://www.youtube.com/watch?v=W_H_RS4M0jk":
					assert.ok(data.videos && data.videos.length, "Video page loading failed. -- " + val);
					break;
				case "http://www.yahoo.com":
					assert.ok(data.images && data.images.length > 1, "Loading of page with no og tag and multiple images failed. -- " + val);
					break;
				case "http://www.cricinfo.com":
					assert.ok(!data.loadFailed && data.images.length, "Loading of a page with redirect failed. -- " + val);
					break;
				case "http://www.huffingtonpost.com/2012/11/15/bp-criminal-settlement-gulf-spill_n_2140162.html":
					assert.ok(data.images && data.images.length == 1, "Loading of a page with og tags failed. -- " + val);
					break;
				case "https://twitter.com/MindbIowingFact/status/268108381351469056/photo/1":
					assert.ok(!data.loadFailed && data.images, "Loading of a https page failed. -- " + val);
					break;
				case "http://www.hollywoodreporter.com/sites/default/files/2012/10/penguin_books_random_house_a_l.jpg":
					assert.ok(!data.loadFailed && (data.contentType == "image/jpeg"), "Loading of an image url failed. -- " + val);
					break;
				default:
					assert.ok(!data.loadFailed, "Test failed. -- " + val);
			}
		}
	});
});
