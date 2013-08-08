  // returns a function that stores stops & routes to be used for a multiple stop query
var queryStorageMaker = function() {
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

var queriesToStop = queryStorageMaker();
var queriesToDest = queryStorageMaker();

var makeChart = function(stop, route) {
  var chart = {};

  $chartArea = $("#chartArea");

  $chartArea.html('<h2 class="route_title">'+ routesList[route] + '</h2>');

  var blah = $chartArea.append('<div class="chart_class"></div>');
  chart.div = $chartArea.children().last();

  chart.vis = d3.select(chart.div[0]).append("svg:svg")
                .style('border', '1px solid rgba(153,153,153, 0.5)');
  (chart.vis).append("svg:g").attr("class", 'centerGroup');

  $("#additionalInfo").text("Each arc represents the number of minutes for a bus to each your stop.");

  updateChart(stop, route, chart);

  return chart;
};

var updateChart = function(stop, route, chart) {

  var getSixSoonest = function(times) {
    var sorted = _.sortBy(times, function(time){
      return parseInt(time.seconds, 10);
    });
    return (sorted.length>6) ? sorted.slice(0,6) : sorted;
  };

  var parseAndRender = function(xml) {
    var times = getSixSoonest(parseXMLmulti(xml));
    render(times, chart.vis);
  };

  if(chart.timer) { window.clearInterval(chart.timer); }

  var dest = $("#destSelector").val();

  chart.queryStop = queriesToStop(stop, route);
  chart.queryDest = queriesToDest(dest, route);

  getMultiStops(chart.queryStop, parseAndRender);

  chart.timer = setInterval(function(){
    getMultiStops(chart.queryStop, parseAndRender);
  }, 14500);
};

var render = function(dataset, vis) {

  // constants
  var w = $(vis[0]).width();
  var h = $(vis[0]).height();
  var smlr = (w<h) ? w : h;

  var cX = Math.round(w/2);
  var cY = ((h/2) > w) ? Math.floor(h/3) : Math.floor(h/2);

  var pi = Math.PI;
  var arcMin = Math.floor(smlr*0.15)  ;
  var arcWidth = Math.floor(arcMin/3.75);
  var arcPad = Math.ceil(arcWidth*0.1);
  var selectionColor = 'rgb(252,125,71)';

  var colorScale = d3.scale.linear()
      .domain([0, d3.max(dataset, function(d) { return parseInt(d.seconds, 10); })])
      .range(["rgb(242,229,211)","rgb(191,223,205)","rgb(139,206,180)"]);

  var transitionTime = 3000;

    // main group where objects are located -- saves from declaring multiple transforms
  var g = vis.select("g.centerGroup");
  g.attr("transform", 'translate('+ cX +','+ cY +')');

  var gArc = g.selectAll("g.arcGroup");
  var d3centerText = g.selectAll("#timeDisplay");

    // checks to see if the past bus has rolled off, if so, delete the associated graphic
  if(gArc[0] && gArc[0][0]) {
    var pastBus = d3.select(gArc[0][0]).select("path.arcPath").datum();
    if( (pastBus.seconds<45) && (dataset[0].vehicle != pastBus.vehicle) ) {
      transitionTime = 1000;
      gArc[0][0].remove();
      gArc[0].splice(0,1);
    }
  }

  gArc = gArc.data(dataset);
  var centerTextData = [dataset[0]];

  var updateCenter = function(newData) {
    d3centerText.data(newData).text(function(d){
      return toMin(d.seconds);
    })
    .style("font-size", Math.floor(arcMin*1.44) + 'px')
    .attr("transform", 'translate(0,'+ parseInt(arcMin/2, 10) +')');
  };

  var toMin = function(sec) {
    var fuzzy = 5*( 5 - sec/60 );
    return ( sec%60 > fuzzy ) ? Math.ceil(sec/60) : Math.floor(sec/60);
  };

    // defining arc accessor
  var arc = d3.svg.arc()
      .innerRadius(function(d, i) {
        return arcMin + i*(arcWidth) + arcPad;
      })
      .outerRadius(function(d, i) {
        return arcMin + (i+1)*(arcWidth);
      })
      .startAngle(0 * (pi/180))
      .endAngle(function(d) {
        return parseFloat((d.seconds/60)*6 * (pi/180));
      });

    // update for arcs
  gArc.select("path.arcPath")
      .transition()
      .duration(transitionTime)
      .attr("fill", function(d){
        if(d3.select(this).attr("fill")===selectionColor) {
          centerTextData = [d3.select(this).datum()];
          updateCenter(centerTextData);
          return selectionColor;
        } else {
          return colorScale(d.seconds);
        }
      })
      .attr("d", arc);

    // enter for arcs
  gArc.enter().append("svg:g").attr("class", 'arcGroup')
      .append("svg:path")
      .attr("class", 'arcPath')
      .attr("fill", function(d){
        return colorScale(d.seconds);
      })
      .attr("d", arc);

    // moved event handler from enter() as there were closure issues with referencing old dataset[0]
  d3.selectAll("path.arcPath")
    .on("click", function(d, i){
        var d3selected = d3.select(this);

        if(d3selected.attr("fill")===selectionColor) {
          d3selected.attr("fill", colorScale(d3selected.datum().seconds));
          centerTextData = [dataset[0]];
        } else {
          _(d3.selectAll("path")[0]).each(function(arcPath){
            var d3arc = d3.select(arcPath);
            d3arc.attr("fill", colorScale(d3arc.datum().seconds));
          });
          d3selected.attr("fill", selectionColor);
          centerTextData = [d];
        }
        $('.route_title').text(routesList[centerTextData[0].routeTag]);
        updateCenter(centerTextData);
        console.log(d.routeTag +': '+ d.seconds);
      });

    // enter and update for the center text
  d3centerText = d3centerText.data(centerTextData);
  d3centerText.enter().append("svg:text")
      .attr("id", "timeDisplay")
      .attr("text-anchor", 'middle');
  updateCenter(centerTextData);
};