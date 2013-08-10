  // returns a function that stores stops & routes to be used for a multiple stop query
var queryStorageMaker = function() {
  var memo = {};

  return function(stop, route, del) {
    if( stop && route ) {
      if(del==='true') { delete memo[route]; }
      else {
        memo[route] = {
          r: route,
          s: stop
        };
      }
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

  $chartArea = $("#ChartArea");

  $chartArea.html('<h2 class="route-title">'+ routesList[route] + '</h2>');
  $chartArea.append('<div class="chart-div"></div>');

  chart.div = $chartArea.children().last();

  chart.vis = d3.select(chart.div[0]).append("svg:svg")
                .style('border', '1px solid rgba(153,153,153, 0.5)');
  (chart.vis).append("svg:g").attr("class", 'center-group');

  $("#AdditionalInfo").text("Each arc represents the number of minutes for a bus/train to each your specified stop. You can track additional lines by re-using the form above.");

  updateTitle(routesList[route]);
  updateChart(stop, route, chart);

  return chart;
};

var updateTitle = function(title) {
  return $("#ChartArea .route-title").text(title);
};

var getSixSoonest = function(times) {
  var sorted = _.sortBy(times, function(time){
    return parseInt(time.seconds, 10);
  });
  return (sorted.length>6) ? sorted.slice(0,6) : sorted;
};

var parseAndRender = function(xml, vis) {
  var times = getSixSoonest(parseXMLmulti(xml));
  d3methods.render(times, vis);
};

var updateChart = function(stop, route, chart) {
  if(chart.timer) { window.clearInterval(chart.timer); }

  var dest = $("#destSelector").val();

  chart.stopQueries = queriesToStop(stop, route);
  chart.destQuesties = queriesToDest(dest, route);

  var chartTitle = '';
  var amp = ' & ';

  for(var i=0; i<chart.stopQueries.length; i++) {
    if(i>0) {
      chartTitle += amp;
    }
    chartTitle += routesList[chart.stopQueries[i].r];
  }

  updateTitle(chartTitle);

  getMultiStops(chart.stopQueries, function(xml){
    parseAndRender(xml, chart.vis);
    setTimeout(function(){
      d3methods.ripple(chart.vis);
    }, 500);
  });

  chart.timer = setInterval(function(){
    getMultiStops(chart.stopQueries, function(xml){
      parseAndRender(xml, chart.vis);
    });
  }, 14500);
};

var d3methods = {

  _selectionColor: '#fc7d47',
  _highlightColor: '#deae8a',

  _toMin: function(sec) {
    var fuzzy = 5*( 5 - sec/60 );
    return ( sec%60 > fuzzy ) ? Math.ceil(sec/60) : Math.floor(sec/60);
  },

  _colorScaleMaker: function(max) {
    return d3.scale.linear()
        .domain([0, max])
        .range(["rgb(242,229,211)", "rgb(191,223,205)", "rgb(139,206,180)"]);
  },

  ripple: function(vis) {
    var d3arcs = vis.selectAll("path.arc-path");
    var d3centerText = vis.selectAll("text.center-time");

    var lastIndex = d3arcs[0].length-1;

    var colorScale = d3methods._colorScaleMaker( d3.select(d3arcs[0][lastIndex]).datum().seconds );
    var selectionColor = d3methods._selectionColor;
    var highlightColor = d3methods._highlightColor;

    d3arcs.transition()
          .delay(function(d, i){
            return i*400;
          })
          .duration(800)
          .attr("fill", highlightColor)
          .each("start", function(d, i){
            d3centerText.transition()
                .delay(440)
                .text(d3methods._toMin(d.seconds));
          })
          .each("end", function(d, i) {
            var indx = i;
            d3.select(this).transition()
                .duration(350)
                .attr("fill", colorScale(d.seconds))
                .each("end", function(d, i) {
                  if(indx===lastIndex) {
                    d3centerText.transition()
                        .delay(100)
                        .text(d3methods._toMin(d3centerText.datum().seconds));
                    d3.select(d3arcs[0][0]).transition()
                        .duration(300)
                        .attr("fill", selectionColor);
                  }
              });
          });
  },


  render: function(dataset, vis) {
    // constants
    var w = $(vis[0]).width();
    var h = $(vis[0]).height();
    var smlr = (w<h) ? w : h;

    var cX = Math.round(w/2);
    var cY = ((h/2) > w) ? Math.floor(h/3) : Math.floor(h/2);

    var pi = Math.PI;
    var arcMin = Math.floor(smlr*0.15);
    var arcWidth = Math.floor(arcMin/3.75);
    var arcPad = Math.ceil(arcWidth*0.1);
    var selectionColor = d3methods._selectionColor;
    var highlightColor = d3methods._highlightColor;

    var colorScale = d3methods._colorScaleMaker( d3.max(dataset, function(d) {
      return parseInt(d.seconds, 10);
    }) );

    var transitionTime = 3000;

      // main group where objects are located -- saves from declaring multiple transforms
    var g = vis.select("g.center-group");
    g.attr("transform", 'translate('+ cX +','+ cY +')');

    var gArc = g.selectAll("g.arc-group");
    var d3centerText = g.selectAll(".center-time");

      // checks to see if the past bus has rolled off, if so, delete the associated graphic
    if(gArc[0] && gArc[0][0]) {
      var pastBus = d3.select(gArc[0][0]).select("path.arc-path").datum();
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
        return d3methods._toMin(d.seconds);
      })
      .style("font-size", Math.floor(arcMin*1.44) + 'px')
      .attr("transform", 'translate(0,'+ parseInt(arcMin/2, 10) +')');
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
          return Math.round(parseFloat((d.seconds/60)*6 * (pi/180)) * 10000, 10)/10000;
        });

      // update for arcs
    gArc.select("path.arc-path").transition()
        .duration(transitionTime)
        .attr("fill", function(d, i){
          if(this.__highlight__) {
            centerTextData = [d];
            return selectionColor;
          }
          return colorScale(d.seconds);
        })
        .attr("d", arc);

      // enter for arcs
    gArc.enter().append("svg:g").attr("class", 'arc-group')
        .append("svg:path")
        .attr("class", 'arc-path')
        .attr("fill", function(d, i){
          if(i===0) {
            this.__highlight__ = true;
            return selectionColor;
          }
          return colorScale(d.seconds);
        })
        .attr("d", arc);

      // moved event handler from enter() as there were closure issues with referencing old dataset[0]
    d3.selectAll("path.arc-path")
      .on("click", function(d, i){
          var d3selected = d3.select(this);

          _(d3.selectAll("path")[0]).each(function(arcPath){
            var d3arc = d3.select(arcPath);
            delete arcPath["__highlight__"];
            d3arc.attr("fill", colorScale(d3arc.datum().seconds));
          });

          this.__highlight__ = true;

          var blender = d3.interpolate(highlightColor, colorScale(d3selected.datum().seconds));

          d3selected.transition()
              .duration(1000)
              .attr("fill", highlightColor)
              .each("end", function(){
                d3selected.transition()
                    .duration(600)
                    .attr("fill", blender(0.5))
                    .each("end", function(){
                      d3selected.transition()
                          .duration(1000)
                          .attr("fill", selectionColor);
                    });
              });

          centerTextData = [d];
          updateTitle(routesList[centerTextData[0].routeTag]);
          updateCenter(centerTextData);

          //console.log(d.routeTag +': '+ d.seconds);
        });

      // enter and update for the center text
    d3centerText = d3centerText.data(centerTextData);
    d3centerText.enter().append("svg:text")
        .attr("class", "center-time")
        .attr("text-anchor", 'middle');
    updateCenter(centerTextData);
  }
};