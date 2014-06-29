var full, width, transitioning = false,
	height = 600, pad = 5, delay = 100,
	fields = ['Name', 'Artist', 'Album', 'Genre', 'Total Time', 'Date Added', 'Play Count', 'Play Date UTC', 'Skip Count', 'Rating', 'Kind'];

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
	})).filter(function(d) { return d['Kind'].indexOf('audio') != -1; });
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
	createDistribution('Rating', '#ratingDistribution', 'Genre', 'Top Genres', 1, function(d) { return d / 20; });
	createDistribution('Total Time', '#timeDistribution', 'Genre', 'Top Genres', 10, function(d) { return d / 1000; });
	createDistribution('Rating', '#artistRatingDistribution', 'Artist', 'Top Artists', 1, function(d) { return d / 20 - .5; });
	createTop('Play Count', '#topArtist', 'Artist', 'Top Artists', ['Name']);
	createCalendar('Play Date UTC', '#lastGenre', 'Genre', 'Top Genres', ['Name', 'Artist', 'Play Count']);
	createCalendar('Date Added', '#addedGenre', 'Genre', 'Top Genres', ['Name', 'Artist', 'Play Count']);
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
			
			svg.selectAll('.top-data').on('click', function(d) {
				queryYouTube(d.name)
			})
			
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
		.attr("dy", 5 - margin.left)
		.style("text-anchor", "end")
		.text("Song Count");
	
	// Initialize legend data
	var legend = createLegend(full.slice(0), legendMetric, svg, legendTitle, z, refresh);
	legend.push({color: 'black', val: 0, name: 'Other'});
	
	refresh([])
	
	// Refreshes data
	function refresh(selected) {
		// Initialize top song data
		var data = getData(selected);
		var filtered = filterData(selected, legendMetric);
		var means = [{name: 'Mean', val: d3.mean(filtered, function(d) { return d[z]; })},
		             {name: 'Median', val: d3.median(filtered, function(d) { return d[z]; })}];
		if (fn) {
			means.forEach(function(d) { d.val = fn(d.val); });
		}
		var colors = d3.scale.category10();
		
		// Create bars and count text
		var keyExtent = d3.extent(data, function(d) { return d.key; });
		var scaleX = d3.scale.linear().domain([Math.min(0, keyExtent[0] - keyExtent[0] % bucket), keyExtent[1] - keyExtent[1] % bucket + bucket]).range([0, width - margin.left - margin.right]);
		var scaleY = d3.scale.linear().domain([0, d3.max(data, function(d) {
			return Object.keys(d.val).reduce(function(a, cur) { return a + parseInt(d.val[cur].count); }, 0);
		}) * 1.1]).range([height - margin.bottom - margin.top, 0]);
		
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
		svg.selectAll('.means').data(means).enter().append('line').attr('class', 'means')
			.attr('y1', margin.top).attr('x1', function(d) { return margin.left + scaleX(d.val); })
			.attr('y2', height - margin.bottom).attr('x2', function(d) { return margin.left + scaleX(d.val); });
		
		svg.selectAll('.meansText').data(means).enter().append('text').attr('class', 'meansText')
			.attr('transform', function(d) { return 'translate(' + (margin.left + scaleX(d.val) - 10) + ',' + (margin.top + 40) + ')rotate(-90)'; })
			.text(function(d) { return d.name; });
		
		svg.selectAll('.means').transition().duration(2.5 * delay)
			.attr('y1', margin.top).attr('x1', function(d) { return margin.left + scaleX(d.val); })
			.attr('y2', height - margin.bottom).attr('x2', function(d) { return margin.left + scaleX(d.val); });
		
		svg.selectAll('.meansText').transition().duration(2.5 * delay)
			.attr('transform', function(d) { return 'translate(' + (margin.left + scaleX(d.val) - 10) + ',' + (margin.top + 40) + ')rotate(-90)'; });

		xAxisEl.transition().duration(delay).call(xAxis);
		yAxisEl.transition().duration(delay).call(yAxis);
	}
	
	// Aggregates filtered play count distributions
	function getData(selected) {
		var filtered = full.filter(function(d) { return selected.length == 0 || selected.indexOf(d[legendMetric]) != -1; });
		filtered.forEach(function(d) {
			d['Temp'] = d[z];
			if (fn) {
				d['Temp'] = fn(d['Temp']);
			}
			d['Temp'] -= d['Temp'] % bucket;
		});
		var raw = aggregateMetricLegend(filtered, 'Temp', legend, legendMetric);
		var extent = d3.extent(raw, function(d) { return parseInt(d.name); });
		var w = (width - margin.left - margin.right) / (extent[1] - Math.min(0, extent[0]) + bucket);
		return raw.map(function(d, i) {
			return {w: w * bucket, val: d.val, key: parseInt(d.name)};
		});
	}
	
	// Get bar color
	function getColor(d, legend) {
		var c = $.grep(legend, function(g) { return g.name == d.data[legendMetric]; });
		return c.length != 0 ? c[0].color : 'black';
	}
}

/**
 * Creates a calendar view based on a date metric
 * @param z - Metric
 * @param id - Id of chart container
 * @param legendMetric - Metric used to create the legend
 * @param legendTitle - Title for the legend
 * @param textArray - Array of fields to concatenate into a label
 */
function createCalendar(z, id, legendMetric, legendTitle, textArray) {
	var margin = {left: 20, right: 350, top: 50, bottom: 20}, cellSize = (width - margin.left - margin.right) / 54, height = cellSize * 8, lineHeight = 20;
	// Remove old svg
	d3.select(id).selectAll('svg').remove();
	
	// Initialize calendar data
	var data = getData([]);
	var years = d3.extent(Object.keys(data), function(d) { return parseInt(d.substring(0, 4)); });
	
	// Create SVG
	var mainSvg = d3.select(id).append('svg')
		.attr('width', width).attr('height', margin.top + margin.bottom + height * (years[1] - years[0] + 1));
	
	// Initialize legend data
	var legend = createLegend(full.slice(0), legendMetric, mainSvg, legendTitle, 'Play Count', refresh);
	
	var day = d3.time.format("%w"),
		week = d3.time.format("%U"),
		format = d3.time.format("%Y-%m-%d");
	
	var focusStart = [width - margin.right, margin.top];
	
	var focusDate = mainSvg.append('text').attr('transform', 'translate(' + (focusStart[0] + 10) + ',' + (focusStart[1] + 40) +')')
		.text('').style('font-size', 22);
	
	var focusResults = mainSvg.append('g').attr('transform', 'translate(' + (focusStart[0] + 10) + ',' + (focusStart[1] + 70) +')')
	
	var svg = mainSvg.selectAll("g.RdYlGn")
		.data(d3.range(years[0], years[1] + 1))
		.enter().append("g")
		.attr("width", cellSize * 56)
		.attr("height", height)
		.attr("class", "RdYlGn")
		.attr("transform", function(d, i) { return "translate(" + margin.left + "," + (margin.top + height * i + 20) + ")" });
	
	svg.append("text")
		.attr("transform", "translate(-6," + cellSize * 3.5 + ")rotate(-90)")
		.style("text-anchor", "middle")
		.text(function(d) { return d; });
	
	var rect = svg.selectAll(".day")
		.data(function(d) { return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
		.enter().append("rect")
		.attr("class", "day")
		.attr("width", cellSize - 1)
		.attr("height", cellSize - 1)
		.attr("x", function(d) { return week(d) * cellSize; })
		.attr("y", function(d) { return day(d) * cellSize; })
		.datum(format)
	
	rect.append("title")
		.text(function(d) { return d; });
	
	svg.selectAll(".month")
		.data(function(d) { return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1)); })
		.enter().append("path")
		.attr("class", "month")
		.attr("d", monthPath);
	
	refresh([])
	
	// Refreshes data
	function refresh(selected) {
		// Initialize calendar data
		var data = getData(selected);
		var max = d3.max(Object.keys(data), function(d) { return data[d]; });
		var color = d3.scale.linear()
			.domain([0, max])
			.range(['#999', 'green']);
		
		svg.selectAll(".day").data([]).exit().transition().duration(delay * 10).delay(function(d, i) { return i; }).style('fill', 'white').select("title")
			.text(function(d) { return d; });
				
		rect.filter(function(d) { return d in data; }).transition().duration(delay * 10).delay(function(d, i) { return i * 5; })
			.style("fill", function(d) { return color(data[d]); })
			.select("title")
			.text(function(d) { return d + ": " + data[d] + ' Song' + (data[d] != 1 ? 's' : ''); });
		
		rect.on('click', function(d) {
			$('#focus').removeAttr('id');
			d3.select(this).attr('id', 'focus');
			focusDate.text(d);
			var old = full.slice(0).filter(function(e) { return format(new Date(e[z])) == d && (selected.length == 0 || selected.indexOf(e[legendMetric]) != -1); })
				.sort(function(e, f) { return f['Play Count'] - e['Play Count']; });
			old = old.slice(0, Math.min(old.length, Math.round((height * (years[1] - years[0] + 1) - 60) / lineHeight)))
			focusResults.selectAll('text').data(old).exit().remove();
			focusResults.selectAll('text').data(old).enter().append('text')
				.attr('class', 'detailText')
				.attr('transform', function(e, i) { return 'translate(0,' + lineHeight * i + ')'; })
			focusResults.selectAll('text').text(function(e) { return textArray.map(function(f) { return e[f]; }).join(' - '); })
				.on('click', function(d) {
					queryYouTube(d.Name + ' - ' + d.Artist)
				});
		});
		transitioning = false;
	}
	
	function monthPath(t0) {
		var t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
			d0 = +day(t0), w0 = +week(t0),
			d1 = +day(t1), w1 = +week(t1);
		return "M" + (w0 + 1) * cellSize + "," + d0 * cellSize
			+ "H" + w0 * cellSize + "V" + 7 * cellSize
			+ "H" + w1 * cellSize + "V" + (d1 + 1) * cellSize
			+ "H" + (w1 + 1) * cellSize + "V" + 0
			+ "H" + (w0 + 1) * cellSize + "Z";
	}
	
	// Filters down to filtered data
	function getData(selected) {
		var format = d3.time.format("%Y-%m-%d");
		var filtered = full.slice(0).filter(function(d) { return selected.length == 0 || selected.indexOf(d[legendMetric]) != -1; });
		var raw = {};
		filtered.filter(function(d) { return d[z]; }).forEach(function(d) {
			var date = format(new Date(d[z]));
			if (raw[date]) {
				raw[date]++;
			} else {
				raw[date] = 1;
			}
		});
		return raw;
	}
}

/**
 * Filtered the full data but does not format it
 * @param selected - Selected legend values
 * @param legendMetric - Legend metric
 * @returns Filtered full data
 */
function filterData(selected, legendMetric) {
	return full.filter(function(d) { return selected.length == 0 || selected.indexOf(d[legendMetric]) != -1; });
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
		if (all[cur[metric]] != undefined) {
			if (all[cur[metric]][cur[filter]] != undefined) {
				all[cur[metric]][cur[filter]].count++;
			} else {
				all[cur[metric]]['Other'].count++;
			}
		} else if(cur[metric] != undefined) {
			var base = {};
			legend.forEach(function(d) {
				base[d.name] = {color: d.color, count: 0, sort: d.val};
			});
			if (base[cur[filter]] != undefined) {
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
 * @param d - Selected filter data
 * @param me - Selected filter
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

/**
 * Queries YouTube for the input string.
 * @param q - Query string
 */
function queryYouTube(q) {
	window.open('https://youtube.com/results?search_query=' + encodeURIComponent(q), '_blank');
}