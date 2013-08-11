
  // returns a function that stores stops & routes to be used for a multiple stop query
var queryStorageMaker = function() {
  var memo = {};

  return function(stop, route, del) {
    if( stop && route ) {
      var query = {
        r: route,
        s: stop
      };
      if(checkQuery(query)) {
        if(del === 'true') { delete memo[route]; }
        else {
          memo[route] = query;
        }
      }
    }

    var queries = [];
    for(var key in memo) {
      queries.push(memo[key]);
    }
    return queries;
  };
};

  // converts the queries array to a serialised parameter for bookmarking
var serialiseQueries = function(queries) {
  var params = {};
  for(var i=0; i<queries.length; i++) {
    params[i] = queries[i];
  }
  return $.param(params);
};

  // deserialised the parameter and checks them, returning an array of sanitised queries
var deserialiseParams = function(params) {
  var deserialised = $.deparam(params);
  var i = 0, queries = [];
  while(deserialised[i]) {
    if(checkQuery(deserialised[i])) { queries.push(deserialised[i]); }
    i++;
  }

  return queries;
};

  // checks to see if the query has a valid bus line and a stop number of four digits
  //  four digits does *NOT* mean the stop number is necessarily valid
var checkQuery = function(pre) {
  var validRoutes = routesInfo.routesList;
  var regex = /\b\d{4}\b/;
  return (typeof validRoutes[pre.r] === 'undefined' || !regex.test(pre.s)) ? false : true;
};



var makeChart = function(stopTag, routeTag) {
  var chart = {};
  updateChart(stopTag, routeTag, chart);
  return chart;
};

var makeChartView = function(chart) {
  $chartArea = $("#ChartArea");

  $chartArea.html('<h2 class="route-title"></h2>');
  $chartArea.append('<div class="chart-div"></div>');

  chart.div = $chartArea.children().last();

  chart.d3vis = d3.select(chart.div[0]).append("svg:svg")
                .style('border', '1px solid rgba(153,153,153, 0.5)');

  updateChartView(chart);
};

var _queriesToStop = queryStorageMaker();
var _queriesToDest = queryStorageMaker();

var updateChart = function(stopTag, routeTag, chart) {
  var destTag = $("#DestSelector").val();

  chart.stopQueries = _queriesToStop(stopTag, routeTag);
  chart.destQueries = _queriesToDest(destTag, routeTag);

  return chart;
};

var updateFormView = function(stopTag, routeTag, callback) {
  var $routeSel = $("#RouteSelector");
  $routeSel.val(routeTag);

  var dirTag;
  stopTag += '';    // stopTag should be a string, but if it isn't, convert it
  _(routesInfo[routeTag].directions).each(function(dir){
    for(var i=0; i<dir.stops.length; i++) {
      if(dir.stops[i] === stopTag) {
        dirTag = dir.dirTag;
      }
    }
  });

  displayDirections(routesInfo[routeTag].stopsInfo, routesInfo[routeTag].directions, dirTag);

  var $dirSel = $("#DirectionSelector");
  $dirSel.val(dirTag);
  $dirSel.change();

  var $stopSel = $("#StopSelector");
  $stopSel.val(stopTag);
  $stopSel.change();

  if(callback) { callback(stopTag, routeTag); }
};

  // helper function for views
var combineTitles = function(queries) {
  var title = '';

  for(var i=0; i<queries.length; i++) {
    if(i > 0) {
      title += ' & ';
    }
    title += routesInfo.routesList[queries[i].r];
  }
  return title;
};

  // helper function for views
var updateTitle = function(title) {
  return $("#ChartArea .route-title").text(title);
};

  // helper function for views
var getSixSoonest = function(times) {
  var sorted = _.sortBy(times, function(time){
    return parseInt(time.seconds, 10);
  });
  return (sorted.length>6) ? sorted.slice(0,6) : sorted;
};

  // helper function for views
var sortAndRender = function(predictions, vis) {
  var times = getSixSoonest(predictions);
  d3methods.render(times, vis);
};

  // combines predictions for the sake of predicting arrival to destination
var combinePredictions = function(predictions, stopQueries, destQueries) {
    // uses a hash in order to pair the stop and destination times by the vehicle number.
    //  late at night, nextbus might return the a vehicle's second departure time after it's roundtrip run
    //  (e.g. leaving here, there, leaving here again), so seconds are stored as arrays.
    //  unfortunately, it makes for the ugly loops later below

    /*
      Hash Hierarchy = {
        routeTag: {
          vehicle: {
            stop: [seconds, seconds]
          }
        }
      }
    */

  var prsHash = {};
  _(predictions).each(function(prs) {
    if(!prsHash[prs.routeTag]) { prsHash[prs.routeTag] = {}; }
    if(!prsHash[prs.routeTag][prs.vehicle]) { prsHash[prs.routeTag][prs.vehicle] = {}; }
    if(prsHash[prs.routeTag][prs.vehicle][prs.stopTag]) { prsHash[prs.routeTag][prs.vehicle][prs.stopTag].push(prs.seconds); }
    if(!prsHash[prs.routeTag][prs.vehicle][prs.stopTag]) { prsHash[prs.routeTag][prs.vehicle][prs.stopTag] = [prs.seconds]; }
  });

    // there are many loops here, at 4am, they seem necessary..
    //  most loops will be very short, especially stopTimes and destTimes, which will be one iteration
    //  nearly all the time.
  var combined = [];
  for(var i=0; i<stopQueries.length; i++) {
    var query = stopQueries[i];
    for(var busNum in prsHash[query.r]) {
      if(prsHash[query.r][busNum][query.s]) {
        var stopTimes = prsHash[query.r][busNum][query.s];
        for(var j=0; j<stopTimes.length; j++) {
          var pr = {
            routeTag: query.r,
            stopTag: query.s,
            seconds: stopTimes[j],
            vehicle: busNum
          };

          if(destQueries[i] && prsHash[query.r][busNum][destQueries[i].s]) {
            var destTimes = prsHash[query.r][busNum][destQueries[i].s];
            pr.destTag = destQueries[i].s;

            for(var k=j; k<destTimes.length; k++) {
              if(parseInt(destTimes[k], 10) > parseInt(pr.seconds, 10)) {
                pr.destSeconds = destTimes[k];
                break;
              }
            }
          }
          combined.push(pr);
        }
      }
    }
  }
  return combined;
};

var updateChartView = function(chart) {
  if(chart.timer) { window.clearInterval(chart.timer); }
  $(chart.d3vis[0]).empty();
  (chart.d3vis).append("svg:g").attr("class", 'center-group');

  var bookmarkableUrl = window.location.href.split('?')[0] + '?' + serialiseQueries(chart.stopQueries);
  var info = Handlebars.compile('<a class="bookmarkable" href="{{url}}">Bookmarkable URL</a> - Additional Muni lines may be tracked by re-using the form above.');

  updateTitle(combineTitles(chart.stopQueries));
  $("#AdditionalInfo").html(info({ url: bookmarkableUrl }));

  var predictions, combined;
  getMultiStops(chart.stopQueries, chart.destQueries, function(xml){
    predictions = parseXMLmulti(xml);
    combined = combinePredictions(predictions, chart.stopQueries, chart.destQueries);

    sortAndRender(combined, chart.d3vis);
    setTimeout(function(){
      d3methods.ripple(chart.d3vis);
    }, 500);
  });

  chart.timer = setInterval(function(){
    getMultiStops(chart.stopQueries, chart.destQueries, function(xml){
      combined = combinePredictions(parseXMLmulti(xml), chart.stopQueries, chart.destQueries);
      sortAndRender(combined, chart.d3vis);
    });
  }, 14500);
};

var d3methods = {

  _highlightColor: '#fc7d47',
  _transitionColor: '#deae8a',

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
    var highlightColor = d3methods._highlightColor;
    var transitionColor = d3methods._transitionColor;

    d3arcs.transition()
          .delay(function(d, i){
            return i*400;
          })
          .duration(800)
          .attr("fill", transitionColor)
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
                  if(indx === lastIndex) {
                    d3centerText.transition()
                        .delay(100)
                        .text(d3methods._toMin(d3centerText.datum().seconds));
                    d3.select(d3arcs[0][0]).transition()
                        .duration(300)
                        .attr("fill", highlightColor);
                  }
              });
          });
  },


  render: function(dataset, vis) {
    // constants
    var w = $(vis[0]).width();
    var h = $(vis[0]).height();
    h = (h < w) ? h : w;
    console.log("w", $(vis[0]).width());
    console.log("h", $(vis[0]).height());

    var cX = Math.round(w/2);
    var cY = Math.floor(h/2);

    var pi = Math.PI;
    var arcMin = Math.floor(h*0.15);
    var arcWidth = Math.floor(arcMin/3.75);
    var arcPad = Math.ceil(arcWidth*0.1);
    var highlightColor = d3methods._highlightColor;
    var transitionColor = d3methods._transitionColor;

    var colorScale = d3methods._colorScaleMaker( d3.max(dataset, function(d) {
      return parseInt(d.seconds, 10);
    }) );

    var updateCenter = function(newData) {
      d3centerText.data(newData).text(function(d){
        return d3methods._toMin(d.seconds);
      })
      .style("font-size", Math.floor(arcMin*1.44) + 'px')
      .attr("transform", 'translate(0,'+ parseInt(arcMin/2, 10) +')');
    };

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
      //  loop below is to see if there is a highlighted arc
    var hasHighlight = false;
    gArc.select("path.arc-path").each(function(d){
      if(this.__highlight__) { hasHighlight = true; }
    });

      // re-colors the arcs, if there is no highlighted arc (from above), highlight the first one
    gArc.select("path.arc-path").transition()
        .duration(transitionTime)
        .attr("fill", function(d, i){
          if(!hasHighlight && i === 0) {
            this.__highlight = true;
          }
          if(this.__highlight__) {
            centerTextData = [d];
            return highlightColor;
          }
          return colorScale(d.seconds);
        })
        .attr("d", arc);

      // enter for arcs
    gArc.enter().append("svg:g").attr("class", 'arc-group')
        .append("svg:path")
        .attr("class", 'arc-path')
        .attr("fill", function(d, i){
          if(i === 0) {
            this.__highlight__ = true;
            return highlightColor;
          }
          return colorScale(d.seconds);
        })
        .attr("d", arc);

      // moved event handler from enter() as there were closure issues with referencing old dataset[0]
    d3.selectAll("path.arc-path")
      .on("click", function(d, i){
          var d3selected = d3.select(this);

          _(d3.selectAll("path")[0]).each(function(arcPath){
            delete arcPath["__highlight__"];

            var d3arc = d3.select(arcPath);
            d3arc.attr("fill", colorScale(d3arc.datum().seconds));
          });

          this.__highlight__ = true;
          d3selected.transition()
              .duration(300)
              .attr("fill", highlightColor);

          centerTextData = [d];

          var busTitle = routesInfo.routesList[d.routeTag];
          var stopTitle = routesInfo[d.routeTag].stopsInfo[centerTextData[0].stopTag].title;

          updateTitle(busTitle +' arriving at '+ stopTitle);
          updateCenter(centerTextData);
        });

      // enter and update for the center text
    d3centerText = d3centerText.data(centerTextData);
    d3centerText.enter().append("svg:text")
        .attr("class", "center-time")
        .attr("text-anchor", 'middle');
    updateCenter(centerTextData);
  }
};