var full, width, transitioning = false,
	height = 600, pad = 5, delay = 100,
	fields = ['Name', 'Artist', 'Album', 'Genre', 'Total Time', 'Date Added', 'Play Count', 'Play Date UTC', 'Skip Count', 'Rating'];

$(function() {
	width = $('.svg').width();
	var stored = window.localStorage['full-data'];
	if (stored) {
		full = decompress(JSON.parse(stored));
		createAll();
	} else {
		reset()
	}
});

/**
 * Resets data to default data.
 */
function reset() {
	$.get( "./data/Library.xml", function(data) {
		parseXML($(data).children('plist').children('dict'));
	});
}

function upload() {
	var file = $('#file').get(0).files[0];
	if (file) {
		var r = new FileReader();
		r.onload = function(e) {
			var doc = $.parseXML(e.target.result);
			parseXML($(doc).children('plist').children('dict'))
		}
		r.readAsText(file)
	} else {
		console.log('No file')
	}
}

/**
 * Parses xml and creates full data.
 * @param xml - XML document containing track data
 */
function parseXML(xml) {
	var date = new Date(xml.children('date').text());
	var raw = xml.children('dict').children('dict')
	full = $.makeArray(raw.map(function(i, d) {
		var obj = {};
		$(d).find('key').each(function(i, d) {
			if (fields.indexOf($(this).text()) != -1) {
				var val = $(this).next().text();
				if (!isNaN(val)) {
					val = parseInt(val);
				}
				obj[$(this).text()] = val;
			}
		});
		return obj;
	}));
	window.localStorage['full-data'] = JSON.stringify(compress(full));
	createAll();
}

/**
 * Creates all visualizations
 */
function createAll() {
	createTop('Play Count', '#topPlay', 'Genre', 'Top Genres', ['Name', 'Artist']);
	createTop('Skip Count', '#topSkip', 'Genre', 'Top Genres', ['Name', 'Artist']);
	createDistribution('Play Count', '#playDistribution', 'Genre', 'Top Genres', 5);
	createDistribution('Total Time', '#timeDistribution', 'Genre', 'Top Genres', 10, function(d) { return d / 1000; });
	createTop('Play Count', '#topArtist', 'Artist', 'Top Artists', ['Name']);
	createTop('Skip Count', '#topSkippedArtist', 'Artist', 'Top Artists', ['Name']);
}

/**
 * Creates a top graph.
 * @param z - Metric
 * @param id - Id of chart container
 * @param legendMetric - Metric used to create the legend
 * @param legendTitle - Title for the legend
 * @param textArray - Array of fields to concatenate into a label
 */
function createTop(z, id, legendMetric, legendTitle, textArray) {
	var margin = {left: 20, right: 40, top: 50, bottom: 20};
	// Remove old svg
	d3.select(id).select('svg').remove();
	
	// Create SVG
	var svg = d3.select(id).append('svg')
		.attr('width', width).attr('height', height);
	
	// Initialize genre data
	var legend = createLegend(full.slice(0), legendMetric, svg, legendTitle, z, refresh);
	
	refresh([])
	
	// Refreshes data
	function refresh(selected) {
		// Initialize top song data
		var data = getData(selected);
		
		var x0 = d3.max(data, function(d) { return getTextSize(d.name); }) + margin.left;
		
		// Create bars and count text
		var scale = d3.scale.linear().domain([0, d3.max(data, function(d) { return d.data[z]; })]).range([0, width - margin.right - x0]);
		svg.selectAll('.top-name').data(data).exit().remove();
		svg.selectAll('.top-data').data(data).exit().remove();
		svg.selectAll('.top-count').data(data).exit().remove();
		
		svg.selectAll('.top-name, .top-count').transition().duration(delay).delay(function(d, i) { return 10 * i; }).style('opacity', 0);
		
		setTimeout(function() {
			var nameText = svg.selectAll('.top-name').data(data).enter()
				.append('text')
				.attr('class', 'top-name')
				.attr('transform', function(d) { return 'translate(' + (x0 - 5) + ',' + (d.y + 12) + ')'; })
				.style('opacity', 0)
				.text(function(d) { return d.name; });
			var rects = svg.selectAll('.top-data').data(data).enter()
				.append('rect')
				.attr('class', 'top-data')
				.attr('width', 0)
				.attr('height', function(d) { return d.h; })
				.attr('transform', function(d) { return 'translate(' + x0 + ',' + d.y + ')'; })
				.style('fill', function(d) { return getColor(d, legend); });
			var countText = svg.selectAll('.top-count').data(data).enter()
				.append('text')
				.attr('class', 'top-count')
				.attr('transform', function(d) { return 'translate(' + (x0 + 5) + ',' + (d.y + 12) + ')'; })
				.text(function(d) { return d.data[z]; });
			
			// Transitions
			svg.selectAll('.top-data').transition().duration(delay).delay(function(d, i) { return 10 * i; }).attr('transform', function(d) { return 'translate(' + x0 + ',' + d.y + ')'; })
				.attr('width', function(d) { return scale(d.data[z]); }).style('fill', function(d) { return getColor(d, legend); })
			svg.selectAll('.top-name').transition().duration(delay).delay(function(d, i) { return 10 * i; }).attr('transform', function(d) { return 'translate(' + (x0 - 5) + ',' + (d.y + 12) + ')'; })
				.style('opacity', 1).text(function(d) { return d.name; });
			svg.selectAll('.top-count').transition().duration(delay).delay(function(d, i) { return 10 * i; }).style('opacity', 1).attr('transform', function(d) { return 'translate(' + (scale(d.data[z]) + x0 + 5) + ',' + (d.y + 15) + ')'; }).text(function(d) { return d.data[z]; });
			transitioning = false;
		}, svg.selectAll('.top-data')[0].length == 0 ? 0 : delay);
	}
	
	// Filters down to top songs
	function getData(selected) {
		var filtered = full.slice(0).filter(function(d) { return selected.length == 0 || selected.indexOf(d[legendMetric]) != -1; });
		var raw = filtered.sort(function(a, b) { return (b[z] ? b[z] : 0) - (a[z] ? a[z] : 0); }).slice(0, Math.min(filtered.length, 25));
		var h = (height - margin.top - margin.bottom) / raw.length -  pad;
		return raw.map(function(d, i) {
			var c = d[z];
			return {data: d, y: (h + pad) * i + pad / 2 + margin.top, h: h, name: textArray.map(function(e) { return d[e]; }).join(' - ')};
		});
	}
	
	// Get bar color
	function getColor(d, genres) {
		var c = $.grep(genres, function(g) { return g.name == d.data[legendMetric]; });
		return c.length != 0 ? c[0].color : 'black';
	}
}

/**
 * Creates a distribution graph.
 * @param z - Metric
 * @param id - Id of chart container
 * @param legendMetric - Metric used to create the legend
 * @param legendTitle - Title for the legend
 * @param bucket - Bucket size
 * @param fn - Optional function to preprocess metric data
 */
function createDistribution(z, id, legendMetric, legendTitle, bucket, fn) {
	var margin = {left: 55, right: 20, top: 50, bottom: 40};
	// Remove old svg
	d3.select(id).select('svg').remove();
	
	// Create SVG
	var svg = d3.select(id).append('svg')
		.attr('width', width).attr('height', height);
	
	var xAxisEl = svg.append("g")
	    .attr("class", "x axis")
	    .attr("transform", "translate(" + margin.left + "," + (height - margin.bottom) + ")");
	xAxisEl.append("text")
		.attr("x", width - margin.right - 40)
		.attr("dy", margin.bottom - 5)
		.style("text-anchor", "end")
		.text(z);
	
	var yAxisEl = svg.append("g")
	    .attr("class", "y axis")
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
	yAxisEl.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 6)
		.attr("dy", 10 - margin.left)
		.style("text-anchor", "end")
		.text("Count");
	
	// Initialize legend data
	var legend = createLegend(full.slice(0), legendMetric, svg, legendTitle, z, refresh);
	legend.push({color: 'black', val: 0, name: 'Other'});
	
	refresh([])
	
	// Refreshes data
	function refresh(selected) {
		// Initialize top song data
		var data = getData(selected);
		var colors = d3.scale.category10();
		
		// Create bars and count text
		var keyMax = d3.max(data, function(d) { return d.key; });
		var scaleX = d3.scale.linear().domain([0, keyMax - keyMax % bucket + bucket]).range([0, width - margin.left - margin.right]);
		var scaleY = d3.scale.linear().domain([0, d3.max(data, function(d) {
			return Object.keys(d.val).reduce(function(a, cur) { return a + parseInt(d.val[cur].count); }, 0);
		})]).range([height - margin.bottom - margin.top, 0]);
		
		var xAxis = d3.svg.axis()
		    .scale(scaleX)
		    .orient("bottom");
		
		var yAxis = d3.svg.axis()
		    .scale(scaleY)
		    .orient("left");
		
		svg.selectAll('.dist-data').data([]).exit().transition().duration(delay)
			.attr('height', 0)
			.attr('transform', function(d) { return 'translate(' + (margin.left + scaleX(d.key)) + ',' + (height - margin.bottom) + ')'; }).remove();
		data.forEach(function(e, i) {
			var vals = Object.keys(e.val).map(function(d) { return {name: d, color: e.val[d].color, count: e.val[d].count, sort: e.val[d].sort}; })
						.sort(function(a, b) { return b.sort - a.sort; });
			var total = 0;
			vals.forEach(function(d) {
				d.start = total;
				total += d.count;
				d.key = e.key;
			});
			setTimeout(function() {
				var rects = svg.selectAll('.dist-data .bucket' + e.key).data(vals).enter()
					.append('rect')
					.attr('class', 'dist-data bucket' + e.key)
					.attr('width', function(d) { return e.w; })
					.attr('height', 0)
					.attr('transform', function(d) { return 'translate(' + (margin.left + scaleX(e.key)) + ',' + (height - margin.bottom) + ')'; })
					.style('fill', function(d, i) { return d.color; });
				
				// Transitions
				svg.selectAll('.dist-data.bucket' + e.key).transition().duration(delay).delay(function(d, i) { return 10 * i; })
					.attr('transform', function(d) { return 'translate(' + (margin.left + scaleX(e.key)) + ',' + (scaleY(d.start + d.count) + margin.top) + ')'; })
					.attr('height', function(d) { return height - margin.bottom - margin.top - scaleY(d.count); })
					.attr('width', function(d) { return e.w; });
				transitioning = false;
			}, delay * 1.5)
		});
		
		

		xAxisEl.transition().duration(delay).call(xAxis);
		yAxisEl.transition().duration(delay).call(yAxis);
	}
	
	// Aggregates filtered play count distributions
	function getData(selected) {
		var filtered = full.filter(function(d) { return selected.length == 0 || selected.indexOf(d['Genre']) != -1; });
		filtered.forEach(function(d) {
			d['Temp'] = d[z];
			if (fn) {
				d['Temp'] = fn(d['Temp']);
			}
			d['Temp'] -= d['Temp'] % bucket;
		});
		var raw = aggregateMetricLegend(filtered, 'Temp', legend, 'Genre');
		var max = d3.max(raw, function(d) { return parseInt(d.name); });
		var w = (width - margin.left - margin.right) / max;
		return raw.map(function(d, i) {
			return {w: w * bucket, val: d.val, key: (parseInt(d.name) - bucket)};
		});
	}
	
	// Get bar color
	function getColor(d, genres) {
		var c = $.grep(genres, function(g) { return g.name == d.data['Genre']; });
		return c.length != 0 ? c[0].color : 'black';
	}
}

/**
 * Creates legend items at attaches an on click function.
 * @param full - Full data set
 * @param metric - Metric of full data set to be aggregated and turned into legend items
 * @param svg - Current SVG
 * @param label - Legend title
 * @param fn - Function to be executed on click, input is an array of the currently selected legend items
 * @returns Updated data array
 */
function createLegend(full, metric, svg, label, counter, fn) {
	var data = aggregateMetric(full, metric, counter);
	var colors = d3.scale.category10();
	// Find genre text sizes
	var total = svg.attr('width');
	data = data.sort(function(a, b) { return b.val - a.val; }).slice(0, Math.min(10, data.length)).reverse().map(function(d, i) {
		var w = getTextSize(d.name);
		total -= w + 4 * pad;
		return {val: d.val, name: d.name, color: colors(i), w: w + 2 * pad, x: total};
	});
	svg.append('text').attr('transform', 'translate(' + (total - 10) + ',30)').text(label).style('font-size', '22px').style('text-anchor', 'end')
	
	// Create genre text so size can be measured
	var legends = svg.selectAll('legend').data(data).enter().append('g').attr('class', 'legend').on('click', function(d) {
		if (!transitioning) {
			transitioning = true;
			var me = d3.select(this);
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
			fn(selected);
		}
	});
	// Create genre rectangles and text
	legends.data(data).append('rect')
		.attr('width', function(d) { return d.w; })
		.attr('height', 30)
		.attr('transform', function(d) { return 'translate(' + d.x + ',10)'; })
		.attr('rx', pad).attr('ry', pad)
		.style('stroke', function(d) { return d.color; });
	legends.append('text')
		.attr('transform', function(d) { return 'translate(' + (d.x + d.w / 2) + ',30)'; })
		.text(function(d) { return d.name; });
	return data;
}

/**
 * Aggregates a metric
 * @param all - Array of data to be aggregated
 * @param metric - Metric to be counted
 * @returns {Array} Array of objects with name of metric value and count
 */
function aggregateMetric(full, metric, counter) {
	var data = [];
	$.each(full.reduce(function(all, cur) {
		if (all[cur[metric]]) {
			all[cur[metric]] += cur[counter];
		} else if(cur[metric]) {
			all[cur[metric]] = cur[counter];
		};
		return all;
	}, {}), function(k, v) {
		data.push({name: k, val: v});
	});
	return data;
}

/**
 * Aggregates a metric
 * @param all - Array of data to be aggregated
 * @param metric - Metric to be counted
 * @param legend - Legend items to aggregate into
 * @param filter - Metric used to generate legend
 * @returns {Array} Array of objects with name of metric value and count
 */
function aggregateMetricLegend(full, metric, legend, filter) {
	var data = [];
	$.each(full.reduce(function(all, cur) {
		if (all[cur[metric]]) {
			if (all[cur[metric]][cur[filter]]) {
				all[cur[metric]][cur[filter]].count++;
			} else {
				all[cur[metric]]['Other'].count++;
			}
		} else if(cur[metric]) {
			var base = {};
			legend.forEach(function(d) {
				base[d.name] = {color: d.color, count: 0, sort: d.val};
			});
			if (base[cur[filter]]) {
				base[cur[filter]].count = 1;
			} else {
				base['Other'].count = 1;
			}
			all[cur[metric]] = base;
		};
		return all;
	}, {}), function(k, v) {
		data.push({name: k, val: v});
	});
	return data;
}

/**
 * Highlights selected filter
 * @param d
 * @param me
 */
function legendFilter(d, me) {
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

// Finds the true size of text when rendered
function getTextSize(text) {
	var t = d3.select('svg').append('text').attr('id', 'test-text').text(text);
	var size = $('#test-text').width();
	t.remove();
	return size + 5;
}

// Compresses full data
function compress(arr) {
	var fields = $.unique(arr.reduce(function(a, cur) { return a.concat(Object.keys(cur)); }, []));
	return arr.reduce(function(a, cur) { a.push(fields.map(function(f) { return cur[f]; })); return a; }, [fields]);
}

// Decompresses full data
function decompress(arr) {
	var fields = arr[0];
	return arr.splice(1).reduce(function(a, cur) { var obj = {}; fields.forEach(function(d, i) { obj[d] = cur[i]; }); a.push(obj); return a; }, [])
}

// Calculates number of bytes in a string
function byteCount(s) {
    return encodeURI(s).split(/%..|./).length - 1;
}