
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

  $chartArea.html('<h3 class="route-title"></h3>');
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
  return _.sortBy(times, function(time){
    return parseInt(time.seconds, 10);
  });
};

  // helper function for views
var sortAndRender = function(predictions, vis) {
  var times = getSixSoonest(predictions);
  d3methods.render(times, vis);
};



var updateChartView = function(chart) {
  if(chart.timer) { window.clearInterval(chart.timer); }
  $(chart.d3vis[0]).empty();
  (chart.d3vis).append("svg:g").attr("class", 'center-group');

  var stopQueries = chart.stopQueries;
      destQueries = chart.destQueries;

  var bookmarkableUrl = window.location.href.split('?')[0] + '?' + serialiseQueries(chart.stopQueries);
  var info = Handlebars.compile('<a class="bookmarkable" href="{{url}}">Bookmarkable URL</a> - Additional Muni lines may be tracked by re-using the form above.');

  updateTitle(combineTitles(stopQueries));
  $("#AdditionalInfo").html(info({ url: bookmarkableUrl }));

  var combined;
  getMultiStops(stopQueries, destQueries, function(xml){
    combined = combinePredictions(hashXMLmulti(xml), stopQueries, destQueries);

    sortAndRender(combined, chart.d3vis);
    setTimeout(function(){
      d3methods.ripple(chart.d3vis);
    }, 500);
  });

  chart.timer = setInterval(function(){
    getMultiStops(chart.stopQueries, chart.destQueries, function(xml){
      combined = combinePredictions(hashXMLmulti(xml), stopQueries, destQueries);
      sortAndRender(combined, chart.d3vis);
    });
  }, 14500);
};

var d3methods = {

  _highlightColor: '#fc7d47',
  _transitionColor: '#deae8a',
  _highlight2Color: 'rgb(250,174,135)',

  _toMin: function(sec) {
    var fuzzy = 5*( 5 - sec/60 );
    return ( sec%60 > fuzzy ) ? Math.ceil(sec/60) : Math.floor(sec/60);
  },

  _secToRadians: function(sec) {
    return Math.round(parseFloat((sec/60)*6 * (Math.PI/180)) * 10000)/10000;
  },

  _arcScaleMaker: function(max) {
    return d3.scale.linear()
        .domain([0, max])
        .range(["rgb(227,227,209)", "rgb(185,218,197)"]);
  },

  _destScaleMaker: function(max) {
    return d3.scale.linear()
        .domain([0, max])
        .range(["rgb(227,227,209)", "rgb(243,231,214)"]);
  },


  ripple: function(vis) {
    var d3arcs = vis.selectAll("path.arc-path");
    var d3centerText = vis.selectAll("text.center-time");

    var lastIndex = d3arcs[0].length-1;

    var arcColorScale = d3methods._arcScaleMaker( d3.select(d3arcs[0][lastIndex]).datum().seconds );
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
                .attr("fill", arcColorScale(d.seconds))
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
    dataset = _.filter(dataset, function(prediction){
      return (prediction.seconds > 0) ? 1 : 0;
    });

    // constants
    var w = $(vis[0]).width();
    var h = $(vis[0]).height();
    h = (h < w) ? h : w;
    console.log("w", $(vis[0]).width());
    console.log("h", $(vis[0]).height());

    var cX = Math.round(w/2);
    var cY = Math.floor(h/2);

    var arcMin = Math.floor(h*0.15);
    var arcWidth = Math.floor(arcMin/3.75);
    var arcPad = Math.ceil(arcWidth*0.1);
    var highlightColor = d3methods._highlightColor;
    var highlight2Color = d3methods._highlight2Color;
    var transitionColor = d3methods._transitionColor;
    var destColor = d3methods._destColor;

    var arcColorScale = d3methods._arcScaleMaker( d3.max(dataset, function(d) {
      return parseInt(d.seconds, 10);
    }) );

    var destColorScale = d3methods._destScaleMaker( d3.max(dataset, function(d) {
      return parseInt(d.secondsTotal, 10);
    }) );


    function updateCenter(newData) {
      d3centerText.data(newData).text(function(d){
        return d3methods._toMin(d.seconds);
      })
      .style("font-size", Math.floor(arcMin*1.44) + 'px')
      .attr("transform", 'translate(0,'+ parseInt(arcMin/2, 10) +')');
    }

    var transitionTime = 3000;

      // main group where objects are located -- saves from declaring multiple transforms
    var g = vis.select("g.center-group");
    g.attr("transform", 'translate('+ cX +','+ cY +')');

    var gArc = g.selectAll("g.arc-group");
    var d3centerText = g.selectAll(".center-time");

    var b = d3.select(gArc.node());

    //   // checks to see if the past bus has rolled off, if so, delete the associated graphic
    // if(gArc[0] && gArc[0][0]) {
    //   var pastBus = d3.select(gArc[0][0]).select("path.arc-path").datum();
    //   if( (pastBus.seconds<45) && (dataset[0].vehicle != pastBus.vehicle) ) {
    //     transitionTime = 3000;
    //     //gArc[0][0].childNodes[0].remove();
    //     gArc[0][0].remove();
    //     gArc[0].splice(0,1);
    //   }
    // }

    var key = function(d) {
      return d.vehicle;
    };

    gArc = gArc.data(dataset, key);
    var centerTextData = [dataset[0]];

      // defining arc accessor
    var r;
    var arc = d3.svg.arc()
        .innerRadius(function(d, i) {
          r = d.index || i;
          return arcMin + r*(arcWidth) + arcPad;
        })
        .outerRadius(function(d, i) {
          r = d.index || i;
          return arcMin + (r+1)*(arcWidth);
        })
        .startAngle(0)
        .endAngle(function(d) {
          return d3methods._secToRadians(d.seconds);
        });

    var arcDest = d3.svg.arc()
      .innerRadius(function(d, i) {
        r = d.index || i;
        return arcMin + r*(arcWidth) + arcPad;
      })
      .outerRadius(function(d, i) {
        r = d.index || i;
        return arcMin + (r+1)*(arcWidth);
      })
      .startAngle(function(d) {
        if(d.seconds < 0) {
          return 0;
        } else {
          var pad = ( parseInt(d.secondsTotal-d.seconds, 10) > 180 ) ? 15 : 8;
          return d3methods._secToRadians(d.seconds + pad);
        }
      })
      .endAngle(function(d) {
        return d3methods._secToRadians(d.secondsTotal);
      });

    function arcTween(a, indx) {
      var end = {
        index: indx,
        seconds: a.seconds
      };
      var inter = d3.interpolateObject(this._current, end);
      this._current = end;
      return function(t) {
        return arc(inter(t), indx);
      };
    }

    function destTween(a, indx) {
      var end = {
        index: indx,
        seconds: a.seconds,
        secondsTotal: a.secondsTotal
      };
      var inter = d3.interpolateObject(this._current, end);
      this._current = end;
      return function(t) {
        return arcDest(inter(t), indx);
      };
    }

    function resetColors(selector, colorizer) {
      _(d3.selectAll(selector)[0]).each(function(arcPath){
        delete arcPath["__highlight__"];
        delete arcPath["__highlight2__"];

        var d3arc = d3.select(arcPath);
        d3arc.attr("fill", colorizer(d3arc.datum().seconds));
      });
    }

    gArc.exit().remove();

      // update for arcs
      //  loop below is to see if there is a highlighted arc
    var hasHighlight = false;
    gArc.select("path.arc-path").each(function(d){
      if( this.__highlight__ || this.__highlight2__ ) { hasHighlight = true; }
    });

      // re-colors the arcs, if there is no highlighted arc (from above), highlight the first one
    gArc.select("path.arc-path").transition()
        .duration(transitionTime)
        .attr("fill", function(d, i){
          if(!hasHighlight && i === 0) {
            this.__highlight__ = true;
          }
          if(this.__highlight__) {
            centerTextData = [d];
            return highlightColor;
          }
          if(this.__highlight2__) {
            centerTextData = [{seconds: d.secondsTotal}];
            return highlight2Color;
          }
          return arcColorScale(d.seconds);
        })
        .attrTween("d", arcTween);

    gArc.select("path.dest-path").transition()
              .duration(transitionTime)
              .attrTween("d", destTween);

      // enter for arcs
    var group = gArc.enter().append("svg:g").attr("class", 'arc-group');

    group.append("svg:path").attr("class", 'arc-path')
          .attr("fill", function(d, i){
            if(i === 0) {
              this.__highlight__ = true;
              return highlightColor;
            }
            return arcColorScale(d.seconds);
          })
          .attr("d", arc)
          .each(function(d, i){
            this._current = {
                index: i,
                seconds: d.seconds
            };
            if( d.secondsTotal && d.secondsTotal < 60*60 ) {
              var indx = i;
              d3.select(this.parentNode).append("svg:path").attr("class", 'dest-path')
                .attr("fill", function(d){
                  return destColorScale(d.secondsTotal);
                })
                .attr("d", function(d, i) {
                  return arcDest(d, indx);
                })
                .each(function(d){
                  this._current = {
                    index: indx,
                    seconds: d.seconds,
                    secondsTotal: d.secondsTotal
                  };
                });
            }
          });

    d3.selectAll("path.arc-path")
      .on("click", function(d, i){
          resetColors("path.arc-path", arcColorScale);
          resetColors("path.dest-path", destColorScale);

          this.__highlight__ = true;
          var d3selected = d3.select(this);
          d3selected.attr("fill", highlightColor);

          centerTextData = [d];

          var busTitle = routesInfo.routesList[d.routeTag];
          var stopTitle = routesInfo[d.routeTag].stopsInfo[centerTextData[0].stopTag].title;

          var minTitle = d3methods._toMin(d.seconds);
          if(minTitle > 0) {
            minTitle = ' in '+ minTitle + ' min';
          } else {
            minTitle = ' in less than 1 min';
          }

          updateTitle(stopTitle +': '+ busTitle + minTitle);
          updateCenter(centerTextData);
        });

    d3.selectAll("path.dest-path")
      .on("click", function(d, i){
          resetColors("path.arc-path", arcColorScale);
          resetColors("path.dest-path", destColorScale);

          this.__highlight__ = true;
          var d3selected = d3.select(this);
          d3selected.attr("fill", highlightColor);

          var d3stopArc = d3.select(this.previousElementSibling);
          this.previousElementSibling.__highlight2__ = true;
          d3stopArc.attr("fill", highlight2Color);

          centerTextData = [{seconds: d.secondsTotal}];

          // var busTitle = routesInfo.routesList[d.routeTag];
          var stopTitle = routesInfo[d.routeTag].stopsInfo[d.stopTag].title;
          var stop2Title = routesInfo[d.routeTag].stopsInfo[d.destTag].title;

          updateTitle(stopTitle + ' to ' + stop2Title);
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