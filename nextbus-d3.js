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

queryAccuMaker = function() {
  var memo = {};

  return function(stop, route, del) {
    if( stop && route ) {
      var rS = '' + route + stop;

      if(del==='true') { delete memo[rS]; }
      else { memo[rS] = [route, stop]; }
    }

    var query = [];
    for(var key in memo) {
      query.push(memo[key]);
    }

    return query;
  };
};

var queriesToStop = queryAccuMaker();
var queriesToDest = queryAccuMaker();

var updateChart = function(stop, route, chart) {

  var getSix = function(times) {
    var sorted = _.sortBy(times, function(time){
      return parseInt(time.seconds, 10);
    });
    return (sorted.length>6) ? sorted.slice(0,6) : sorted;
  };

  if(chart.timer) { window.clearInterval(chart.timer); }
  $(chart.vis[0]).empty();
  $(chart.div).children().first().text(routesList[route]);

  var dest = $("#destSelector").val();

  var queryStop = queriesToStop(stop, route);
  var queryDest = queriesToDest(dest, route);

  getMultiStops(queryStop, function(xml){
    var times = getSix(parseXMLmulti(xml));
    render(times, chart.vis);
  });

  chart.timer = setInterval(function(){
    getMultiStops(queryStop, function(xml){
      var times = getSix(parseXMLmulti(xml));
      render(times, chart.vis);
    });
  }, 14500);
};

var render = function(dataset, vis) {
  console.log("Incoming buses: ", dataset);
  console.log("Times:");
  _(dataset).each(function(time){
    console.log(time.seconds);
  });

  var g = vis.selectAll("g.arcGroup");

  var tr_time = 4500;

  if(g[0] && g[0][0]) {
    var pastBus = d3.select(g[0][0]).select("path.arcPath").datum();
    if( (pastBus.seconds<45) && (dataset[0].vehicle != pastBus.vehicle) ) {
      tr_time = 1500;
      g[0][0].remove();
      g[0].splice(0,1);
    }
  }

  g = g.data(dataset);

  var d3centerText = vis.selectAll("#timeDisplay");
  var centerSec = [dataset[0]];

  var updateCenter = function(newData) {
    d3centerText.data(newData).text(function(d){
      return toMin(d.seconds);
    });
  };

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
        //return parseFloat(d.seconds/60)*6 * (pi/180);
        return parseFloat((d.seconds/30)*6 * (pi/180));
      });

  var greenGradient = function(d) {
    var g = Math.floor((1 - d.seconds/4000)*255);
    return "rgb(0, "+ g +", 0)";
  };

  var toMin = function(sec) {
    return sec/60;
  };

  g.select("path.arcPath")
      .transition()
      .duration(tr_time)
      .attr("fill", function(d){
        if(d3.select(this).attr("fill")===selColor) {
          centerSec = [d3.select(this).datum()];
          updateCenter(centerSec);
          return selColor;
        } else {
          return greenGradient(d);
        }
      })
      .attr("d", arc);

  g.enter().append("svg:g").attr("class", 'arcGroup')
      .append("svg:path")
      .attr("class", 'arcPath')
      .attr("d", arc)
      .attr("transform", 'translate('+ w/2 +','+ h/2 +')')
      .attr("fill", function(d){
        return greenGradient(d);
      })
      .on("click", function(d, i){
        var d3selected = d3.select(this);

        if(d3selected.attr("fill")===selColor) {
          d3selected.attr("fill", greenGradient(d3selected.datum()));
          console.log('first element', dataset[0]);
          updateCenter([dataset[0]]);
        } else {
          _(d3.selectAll("path")[0]).each(function(arcPath){
            var d3arc = d3.select(arcPath);
            d3arc.attr("fill", greenGradient(d3arc.datum()));
          });
          d3selected.attr("fill", selColor);
          updateCenter([d3selected.datum()]);
        }

        console.log(d.routeTag +': '+ d.seconds);
      });

  updateCenter(centerSec);

  d3centerText = d3centerText.data(centerSec);

  d3centerText.enter().append("text")
      .attr("id", "timeDisplay")
      .attr("x", w/2)
      .attr("y", h/2)
      .text(function(d){
        return toMin(d.seconds);
      });
};