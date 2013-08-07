  // makeChart inserts a DIV and SVG within the DIV, returns a chart obj
  //  that keeps track of various items related to the chart

  var w = 500,
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

  // getNextbus(query0, function(xml) {
  //   var stop0 = parseXMLtimes(xml);
  //   getNextbus(query1, function(xml2){
  //     var stop1 = parseXMLtimes(xml2);
  //     var times = syncPredictions(stop0, stop1);

  //     render(times, chart.vis);
  //   });
  // });

  // chart.timer = setInterval(function(){
  //   getNextbus(query0, function(xml) {
  //     var stop0 = parseXMLtimes(xml);
  //     getNextbus(query1, function(xml2){
  //       var stop1 = parseXMLtimes(xml2);
  //       var times = syncPredictions(stop0, stop1);

  //       render(times, chart.vis);
  //     });
  //   });
  // }, 12000);

  getNextbus(query0, function(xml){
    render(parseXMLtimes(xml), chart.vis);
  });

  chart.time = setInterval(function(){
    getNextbus(query0, function(xml){
      render(parseXMLtimes(xml), chart.vis);
    });
  }, 12000);
};

var render = function(dataset, vis) {
  console.log("Incoming buses: ", dataset);
  console.log("Times:");
  _(dataset).each(function(time){
    console.log(time.seconds);
  });

  var g = vis.selectAll("g")
      .data(dataset);

  var skipFlag = false;
  var tr_time = 10500;

    // checking if the bus rolls off the stop
    //    condition: if the last reported time was <30s and the new time is 90s greater
/*  if(bar[0] && bar[0][0]) {
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
*/

  var pi = Math.PI;
  var aMin = 75;
  var aWidth = 15;
  var aPad = 1;

  var selColor = 'rgb(255,0,0)';

  var arc = d3.svg.arc()
      .innerRadius(function(d, i) {
        return aMin + i*(aWidth) + aPad;
      })
      .outerRadius(function(d, i) {
        return aMin + (i+1)*(aWidth);
      })
      .startAngle(0 * (pi/180))
      .endAngle(function(d) {
        //return Math.ceil(d.seconds/60)*6 * (pi/180);
        return parseFloat((d.seconds/30)*6 * (pi/180));
      });

  var greenGradient = function(d) {
    var g = Math.floor((1 - d.seconds/4000)*255);
    return "rgb(0, "+ g +", 0)";
  };

  g.select("path")
      .transition()
      .duration(1000)
      .attr("fill", function(d){
        var d3arc = d3.select(this);
        if(d3arc.attr("fill")===selColor) {
          return selColor;
        } else {
          return greenGradient(d);
        }
      })
      .attr("d", arc);

  g.enter().append("svg:g").append("svg:path")
      .attr("d", arc)
      .attr("transform", 'translate('+ w/2 +','+ h/2 +')')
      .attr("fill", function(d){
        return greenGradient(d);
      })
      .on("click", function(d, i){
        var d3selected = d3.select(this);

        if(d3selected.attr("fill")===selColor) {
          d3selected.attr("fill", greenGradient(d3selected.datum()));
        } else {
          _(d3.selectAll("path")[0]).each(function(arcPath){
            var d3arc = d3.select(arcPath);
            var pathDatum = d3arc.datum();
            d3arc.attr("fill", greenGradient(pathDatum));
          });

           d3selected.attr("fill", selColor);

        }

        console.log(i, ': ', d.seconds);
      });
};