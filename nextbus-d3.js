  // makeChart inserts a DIV and SVG within the DIV, returns a chart obj
  //  that keeps track of various items related to the chart

  var w = 900,
      h = 500;

var makeChart = function(stop, route) {
  var chart = {};

  $(".chartsDiv").prepend('<div class="chart_class"></div>');
  chart.div = $(".chartsDiv").children().first();

  $(chart.div).html('<div class="route_title">'+ routesList[route] + '</div>');

  chart.vis = d3.select(".chart_class:first-child").append("svg:svg")
              .attr('width', w)
              .attr('height', h)
              .style('border', '1px solid black');

  var $svg = $(chart.vis[0]);

  $svg.click(function(){
    var state1 = 'border: 1px solid black';
    var state2 = 'border: 2px solid red';

    $svg.attr("style", ($svg.attr("style")===state1) ? state2 : state1 );
  });

  updateChart(stop, route, chart);

  return chart;
};

var updateChart = function(stop, route, chart) {
  if(chart.timer) { window.clearInterval(chart.timer); }
  $(chart.vis[0]).empty();
  $(chart.div).children().first().text(routesList[route]);

  var query = {command:'predictions', a:'sf-muni', s:stop, r:route};
  var parseAndRender = function(xml) {
    data = parseXMLtimes(xml);
    render(data, chart.vis);
  };

  getNextbus(query, parseAndRender);

  chart.timer = setInterval(function(){
    getNextbus(query, parseAndRender);
  }, 12000);
};

var render = function(dataset, vis) {
  var bar = vis.selectAll('rect');
  var minTxt = vis.selectAll("text");


  var xPad = 10,
      yPad = 10,
      barPad = 1;

  var divisor = 5;

  var xScale = d3.scale.linear()
                  .domain([])
                  .range([xPad,w-xPad]);

  var skipFlag = false;
  var tr_time = 10500;

    // checking if the bus rolls off the stop
    //    condition: if the last reported time was <30s and the new time is 90s greater
  if(bar[0] && bar[0][0]) {
    var pWidth = parseInt( d3.select(bar[0][0]).attr("width") )*divisor;
    if( (pWidth < 30) && ( parseInt(dataset[0]) - pWidth ) > 90 ) {
      skipFlag = true;
      tr_time = 5000;
      bar[0][0].remove();
      minTxt[0][0].remove();
      bar[0].splice(0,1);
      minTxt[0].splice(0,1);
    } else {
      skipFlag = false;
    }
  }

  var barProperties = function(obj){
    obj.attr("y", function(d, i) {
          return i * ((h - 2*yPad) / (dataset.length)) + yPad;
        })
        .attr("width", function(d) {
          return Math.floor(d/divisor);
        })
        .attr("height", (h - 2*yPad)/dataset.length - barPad)
        .attr("fill", function(d) {
          var g = Math.floor((1 - d/5000)*255);
          return "rgb(0, "+ g +", 0)";
        });
  };

  var labelProperties = function(obj) {
    obj.text(function(d) {
          var minutes = Math.floor(d/60);
          return minutes + ' min';
        })
        .attr("x", function(d) {
          var fromEdge = 20;
          if(Math.floor(d/60)>9) {
            fromEdge = 27;
          }
          return Math.floor(d/divisor) - fromEdge;
        })
        .attr("y", function(d, i) {
          return i * ((h - 2*yPad) / (dataset.length) + barPad) + yPad + 10;
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", "11px")
        .attr("fill", "white");
  };

  bar = bar.data(dataset);

  var upBar = bar.transition().duration(tr_time);
  barProperties(upBar);

  var newBar = bar.enter().append('rect').attr("x", xPad);
  barProperties(newBar);

  bar.exit().remove();

  minTxt = minTxt.data(dataset);

  var upMin = minTxt.transition().duration(tr_time);
  labelProperties(upMin);

  var newMin = minTxt.enter().append("text");
  labelProperties(newMin);

  minTxt.exit().remove();
};