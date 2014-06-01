var full, width, margin = {left: 20, right: 20, top: 20, bottom: 20},
	height = 600 - margin.top - margin.bottom, pad = 5, delay = 750;

$(function() {
	width = $('#svg').width() - margin.left - margin.right;
})

function upload() {
	var file = $('#file').get(0).files[0];
	if (file) {
		var r = new FileReader();
		r.onload = function(e) {
			var doc = $.parseXML(e.target.result);
			console.log(doc)
			parseXML($(doc).children('plist').children('dict'))
		}
		r.readAsText(file)
	} else {
		console.log('No file')
	}
}

function parseXML(xml) {
	var date = new Date(xml.children('date').text());
	var raw = xml.children('dict').children('dict')
	full = raw.map(function(i, d) {
		var obj = {};
		$(d).find('key').each(function() {
			obj[$(this).text()] = $(this).next().text()
		})
		return obj;
	})
	createTopSongs();
}

function createTopSongs() {
	var svg = d3.select('#topSongs').append('svg')
		.attr('width', width).attr('height');
	var colors = d3.scale.category10();
	var raw = full.sort(function(a, b) { return a['Track Count'] - b['Track Count']; }).slice(0, Math.min(full.length, 20));
	var w = width / raw.length - 2 * pad;
	var scale = d3.scale.linear().domain(d3.extent(raw, function(d) { return d['Track Count']; })).range([0, height])
	var data = raw.map(function(d, i) {
		var c = d['Track Count'];
		return {count: c, x: w * i + pad, w: w, y: height + margin.top - scale(c), h: scale(c)};
	})
	var rects = svg.selectAll('.topSong-data').data(data).enter()
		.append('rect')
		.attr('width', function(d) { return d.w; })
		.attr('height', function(d) { return d.h; })
		.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; })
		
}