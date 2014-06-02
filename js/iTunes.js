var full, width, margin = {left: 20, right: 40, top: 20, bottom: 20},
	height = 800, pad = 5, delay = 1500;

$(function() {
	width = $('#topSongs').width();
	$.get( "./data/Library.xml", function(data) {
		parseXML($(data).children('plist').children('dict'))
	});
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

// Parses xml and creates full data
function parseXML(xml) {
	var date = new Date(xml.children('date').text());
	var raw = xml.children('dict').children('dict')
	full = $.makeArray(raw.map(function(i, d) {
		var obj = {};
		$(d).find('key').each(function() {
			var val = $(this).next().text();
			if (!isNaN(val)) {
				val = parseInt(val);
			}
			obj[$(this).text()] = val;
		})
		return obj;
	}));
	createTopSongs();
}

// Creates top songs chart
function createTopSongs() {
	// Remove old svg
	d3.select('#topSongs').select('svg').remove();
	// Adjust default parameters
	margin.left = 10;
	margin.top = 50;
	var z = 'Play Count';
	
	// Create SVG
	var svg = d3.select('#topSongs').append('svg')
		.attr('width', width).attr('height', height);
	var colors = d3.scale.category10().domain(d3.range(5));
	
	// Initialize genre data
	var genres = [];
	$.each(full.reduce(function(all, cur) {
		if (all[cur['Genre']]) {
			all[cur['Genre']]++;
		} else if(cur['Genre']) {
			all[cur['Genre']] = 1;
		};
		return all;
	}, {}), function(k, v) {
		genres.push({name: k, count: v});
	});
	
	// Find genre text sizes
	var total = width;
	genres = genres.sort(function(a, b) { return b.count - a.count; }).slice(0, Math.min(10, genres.length)).reverse().map(function(d, i) {
		var w = getTextSize(d.name);
		total -= w + 4 * pad;
		return {count: d.count, name: d.name, color: colors(i), w: w + 2 * pad, x: total};
	});
	svg.append('text').attr('transform', 'translate(' + (total - 10) + ',30)').text('Top Genres').style('font-size', '22px').style('text-anchor', 'end')
	
	// Create genre text so size can be measured
	var genreLegend = svg.selectAll('topSong-genre').data(genres).enter().append('g').attr('class', 'topSong-genre').on('click', function(d) {
		filter(d, d3.select(this));
	});
	// Create genre rectangles and text
	genreLegend.data(genres).append('rect')
		.attr('width', function(d) { return d.w; })
		.attr('height', 30)
		.attr('transform', function(d) { return 'translate(' + d.x + ',10)'; })
		.attr('rx', pad).attr('ry', pad)
		.style('stroke', function(d) { return d.color; });
	genreLegend.append('text')
		.attr('transform', function(d) { return 'translate(' + (d.x + d.w / 2) + ',30)'; })
		.text(function(d) { return d.name; });
	
	refresh([])
	
	// Update filters
	function filter(d, me) {
		var classes = me.attr('class').split(' ');
		if (classes.length == 1) {
			me.select('rect').style('fill', d.color);
			me.select('text').style('fill', 'white');
			me.attr('class', classes[0] + ' selected');
		} else {
			me.select('rect').style('fill', 'none');
			me.select('text').style('fill', '#555555');
			me.attr('class', classes[0]);
		}
		var selected = svg.selectAll('.selected')[0].map(function(d) { return d3.select(d).select('text').text(); });
		refresh(selected);
	}
	
	// Refreshes data
	function refresh(selected) {
		// Initialize top song data
		var data = getData(selected);
		
		var x0 = d3.max(data, function(d) { return getTextSize(d.name); }) + margin.left;
		
		// Create bars and count text
		var scale = d3.scale.linear().domain([0, d3.max(data, function(d) { return d.data[z]; })]).range([0, width - margin.right - x0]);
		svg.selectAll('.topSong-name').data(data).exit().remove();
		svg.selectAll('.topSong-data').data(data).exit().remove();
		svg.selectAll('.topSong-count').data(data).exit().remove();
		
		svg.selectAll('.topSong-name, .topSong-count').transition().duration(delay).style('opacity', 0);
		
		setTimeout(function() {
			var nameText = svg.selectAll('.topSong-name').data(data).enter()
				.append('text')
				.attr('class', 'topSong-name')
				.attr('transform', function(d) { return 'translate(' + (x0 - 5) + ',' + (d.y + 15) + ')'; })
				.style('opacity', 0)
				.text(function(d) { return d.name; });
			var rects = svg.selectAll('.topSong-data').data(data).enter()
				.append('rect')
				.attr('class', 'topSong-data')
				.attr('width', 0)
				.attr('height', function(d) { return d.h; })
				.attr('transform', function(d) { return 'translate(' + x0 + ',' + d.y + ')'; })
				.style('fill', function(d) { return getColor(d, genres); });
			var countText = svg.selectAll('.topSong-count').data(data).enter()
				.append('text')
				.attr('class', 'topSong-count')
				.attr('transform', function(d) { return 'translate(' + (x0 + 5) + ',' + (d.y + 15) + ')'; })
				.text(function(d) { return d.data[z]; });
			
			// Transitions
			svg.selectAll('.topSong-data').transition().duration(delay).attr('transform', function(d) { return 'translate(' + x0 + ',' + d.y + ')'; })
				.attr('width', function(d) { return scale(d.data[z]); }).style('fill', function(d) { return getColor(d, genres); })
			svg.selectAll('.topSong-name').transition().duration(delay).attr('transform', function(d) { return 'translate(' + (x0 - 5) + ',' + (d.y + 15) + ')'; })
				.style('opacity', 1).text(function(d) { return d.name; });
			svg.selectAll('.topSong-count').transition().duration(delay).style('opacity', 1).attr('transform', function(d) { return 'translate(' + (scale(d.data[z]) + x0 + 5) + ',' + (d.y + 15) + ')'; }).text(function(d) { return d.data[z]; });
		}, svg.selectAll('.topSong-data')[0].length == 0 ? 0 : delay);
	}
	
	// Filters down to top songs
	function getData(selected) {
		var filtered = full.filter(function(d) { return selected.length == 0 || selected.indexOf(d['Genre']) != -1; })
		var raw = filtered.sort(function(a, b) { return (b[z] ? b[z] : 0) - (a[z] ? a[z] : 0); }).slice(0, Math.min(filtered.length, 25));
		var h = (height - margin.top - margin.bottom) / raw.length - 2 * pad;
		return raw.map(function(d, i) {
			var c = d[z];
			return {data: d, y: (h + 2 * pad) * i + pad + margin.top, h: h, name: d['Name'] + ' - ' + d['Artist']};
		});
	}
	
	// Get bar color
	function getColor(d, genres) {
		var c = $.grep(genres, function(g) { return g.name == d.data['Genre']; });
		return c.length != 0 ? c[0].color : 'black';
	}
}

// Finds the true size of text when rendered
function getTextSize(text) {
	var t = d3.select('svg').append('text').attr('id', 'test-text').text(text);
	var size = $('#test-text').width();
	t.remove();
	return size;
}