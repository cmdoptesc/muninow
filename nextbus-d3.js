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

  var dest = $("#destSelector").val();

  var query0 = {command:'predictions', a:'sf-muni', s:stop, r:route};
  var query1 = {command:'predictions', a:'sf-muni', s:dest, r:route};

  // var parseAndRender = function(xml) {
  //   var stop0 = parseXMLtimes(xml);
  //   render(stop0, chart.vis);
  // };

  var syncPredictions = function(pre0, pre1) {
    var times = [],
        time0 = [],
        time1 = [];
    var k = 0;

    for(var i=0; i<pre0.length; i++) {
      var prediction0 = { x: i },
          prediction1 = { x: i };

      prediction0.seconds = pre0[i].seconds;
      prediction0.vehicle = pre0[i].vehicle;

      for(var j=k; j<pre1.length; j++) {
        if(pre1[j].vehicle === prediction0.vehicle) {
          prediction1.seconds = pre1[j].seconds - prediction0.seconds;
          prediction1.vehicle = pre1[j].vehicle;
          prediction1.offset = prediction0.seconds;
          k = j;
        }
      }

      time0.push(prediction0);
      time1.push(prediction1);
    }

    times.push(time0);
    times.push(time1);

    return times;
  };

  getNextbus(query0, function(xml) {
    var stop0 = parseXMLtimes(xml);
    getNextbus(query1, function(xml2){
      var stop1 = parseXMLtimes(xml2);
      var times = syncPredictions(stop0, stop1);

      render(times, chart.vis);
    });
  });

  chart.timer = setInterval(function(){
    getNextbus(query0, function(xml) {
      var stop0 = parseXMLtimes(xml);
      getNextbus(query1, function(xml2){
        var stop1 = parseXMLtimes(xml2);
        var times = syncPredictions(stop0, stop1);

        render(times, chart.vis);
      });
    });
  }, 12000);
};

var render = function(dataset, vis) {
  console.log("Incoming buses: ", dataset[0]);

  var layer = vis.selectAll(".layer")
    .data(dataset)
    .enter().append("g")
    .attr("class", "layer");

  var bar = layer.selectAll('rect');
  var minTxt = layer.selectAll("text");

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
    if( (pWidth < 30) && ( parseInt(dataset[0][0].seconds) - pWidth ) > 90 ) {
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
    obj.attr("x", function(d) {
          if(d.offset) {
            return Math.floor(d.offset/divisor) + xPad + 3;
          } else {
            return xPad;
          }
        })
        .attr("y", function(d, i) {
          return i * ((h - 2*yPad) / (dataset[0].length)) + yPad;
        })
        .attr("width", function(d) {
          return Math.floor(d.seconds/divisor);
        })
        .attr("height", (h - 2*yPad)/dataset[0].length - barPad)
        .attr("fill", function(d) {
          if(d.offset) {
            return "rgb(255, 255, 0)";
          } else {
            var g = Math.floor((1 - d.seconds/5000)*255);
            return "rgb(0, "+ g +", 0)";
          }
        });
  };

  var labelProperties = function(obj) {
    obj.text(function(d) {
          var min = Math.floor(d.seconds/60);
          if(d.offset) {
            var offset = Math.floor(d.offset/60);
            min = Math.ceil(d.seconds/60);
            if(min>5) {
              var total = parseInt(min) + parseInt(offset);
              return '+'+ min +' = '+ total +' min';
            } else {
              return '+'+ min;
            }
          } else {
            var minutes = Math.floor(d.seconds/60);
            return min + ' min';
          }
        })
        .attr("x", function(d) {
          var fromEdge = (Math.floor(d.seconds/60)>9) ? 27 : 20;
          if(d.offset) {
            var offset = Math.floor(d.offset/60);
            var total = parseInt(d.seconds) + parseInt(d.offset);
            if( Math.ceil(d.seconds/60) > 5 ) {
              fromEdge += (total>9) ? 27 : 20;
            } else {
              fromEdge = 1;
            }
            return Math.floor(total/divisor) - fromEdge;
          } else {
            return Math.floor(d.seconds/divisor) - fromEdge;
          }
        })
        .attr("y", function(d, i) {
          return i * ((h - 2*yPad) / (dataset[0].length)) + yPad + 10;
        })
        .attr("font-family", "sans-serif")
        .attr("font-size", "11px")
        .attr("fill", function(d) {
          return (d.offset) ? 'black' : 'white';
        });
  };

  bar = bar.data(function(d){
    return d;
  });

  var upBar = bar.transition().duration(tr_time);
  barProperties(upBar);

  var newBar = bar.enter().append('rect').attr("x", xPad);
  barProperties(newBar);

  bar.exit().remove();

  minTxt = minTxt.data(function(d){
    return d;
  });

  var upMin = minTxt.transition().duration(tr_time);
  labelProperties(upMin);

  var newMin = minTxt.enter().append("text");
  labelProperties(newMin);

  minTxt.exit().remove();
};