var nextBusser = function(agency) {
  var nb = {

    routesInfo: {},

      // basic nextbus query, check the Nextbus PDF for commands & options
    getNextbus: function(query, callback) {
      var apiUrl = 'http://webservices.nextbus.com/service/publicXMLFeed';

      $.get(apiUrl, query, function(xml){
          callback.call(this, xml);
      });
    },

      // needed a custom query function since the query URL reuses the "stops" key
      // stopsArray is an array of stop objects in the format: {r: route tag, s: stop tag}
    getMultiStops: function(stopsArray, destsArray, callback) {
      var baseQuery = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni';

      var args = Array.prototype.slice.call(arguments);

      if(_.isArray(args[1]) && _.isFunction(args[2])) {
        destsArray = args[1];
        callback = args[2];
      } else if(_.isFunction(args[1])) {
        destsArray = undefined;
        callback = args[1];
      }

      var query = nb._buildQuery(baseQuery, stopsArray, destsArray);
      $.get(query, function(xml){
        callback.call(this, xml);
      });
    },

      // combines all the stops to form a big query -- does not check for duplicate stops
      // stopsArray & destsArray are array of stop objects in the format: {r: route tag, s: stop tag}
    _buildQuery: function(baseQuery, stopsArray, destsArray) {
      for(var i=0; i<stopsArray.length; i++) {
        baseQuery += '&stops='+ stopsArray[i].r +'|'+ stopsArray[i].s;
        if(destsArray && typeof destsArray[i] !== 'undefined') { baseQuery += '&stops='+ destsArray[i].r +'|'+ destsArray[i].s; }
      }
      return baseQuery;
    },


    parseXMLroutes: function(xml, callback) {
      var routes = [];
      var route = {};

      $(xml).find("body > route").each(function(indx, rt){
        $rt = $(rt);
        route = {
          routeTag: $rt.attr('tag'),
          routeTitle: $rt.attr('title')
        };
        routes.push(route);
      });
      return callback ? callback(routes) : routes;
    },

      // converting raw xml: http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&r=J
      // into two objects, then passing them to a callback or as an object
    parseXMLstops: function(xml, callback) {
      var directions = {};
      var $dir, dirTag;

      $(xml).find('direction').each(function(indx, dir){
        var $dir = $(dir);
        dirTag = $dir.attr('tag');
        directions[dirTag] = {
          title : $dir.attr('title'),
          name : $dir.attr('name'),
          dirTag: dirTag,
          stops : []
        };
        $dir.find('stop').each(function(indx, stop) {
          directions[dirTag].stops.push($(stop).attr('tag'));
        });
      });

      var $route = $(xml).find("body > route");

      var stopsInfo = {
        routeTag: $route.attr('tag'),
        title: $route.attr('title'),
        color: $route.attr('color'),
        oppositeColor: $route.attr('oppositeColor')
      };

      var $stop, stopTag;

      $(xml).find("body route > stop").each(function(indx, stop) {
        $stop = $(stop);
        stopTag = $stop.attr('tag');
        stopsInfo[stopTag] = {
          title : $stop.attr('title'),
          lat : $stop.attr('lat'),
          lon : $stop.attr('lon'),
          stopId : $stop.attr('stopId')
        };
      });

      return callback ? callback(stopsInfo, directions) : {stopsInfo:stopsInfo, directions:directions};
    },

      // parses prediction XML for single stops:
      //  http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=sf-muni&r=5&s=5684
    parseXMLtimes: function(xml, callback) {
      var predictions = [];
      var routeTag = $(xml).find('predictions').attr('routeTag');
      var $pr, prediction;

      $(xml).find('prediction').each(function(indx, pr) {
        $pr = $(pr);
        prediction = {
          routeTag: routeTag,
          seconds: $pr.attr('seconds'),
          vehicle: $pr.attr('vehicle'),
          dirTag: $pr.attr('dirTag')
        };
        predictions.push(prediction);
      });

      return callback ? callback(predictions) : predictions;
    },

      // parses predictionsForMultiStops:
      //  http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni&stops=5|5684&stops=38|5684&stops=38|5689
      //  replaced by hashXMLmulti & combinePredictions to make total trip predictions.
      //  still works fine for parsing multiple stops, but won't discern between stop and destination stop
    parseXMLmulti: function(xml, callback) {
      var predictions = [];
      var $stop, $pr;
      var routeTag, stopTag, prediction;

      $(xml).find('predictions').each(function(indx, prs) {
        $stop = $(prs);
        routeTag = $stop.attr('routeTag');
        stopTag = $stop.attr('stopTag');

        $stop.find('prediction').each(function(indx, pr) {
          $pr = $(pr);
          prediction = {
            routeTag: routeTag,
            stopTag: stopTag,
            seconds: $pr.attr('seconds'),
            vehicle: $pr.attr('vehicle')
          };
          predictions.push(prediction);
        });
      });

      return callback ? callback(predictions) : predictions;
    },

      // groups the stop and destination times by vehicle number in orer to make predictions based
      //  on the difference between two stops. late at night, nextbus might return the vehicle's
      //  second departure time after its roundtrip run (e.g. arriving here, going to the end,
      //  arriving here again), so seconds are stored as arrays.
      // ** needs to work with combinePredictions to return a similar result as parseXMLmulti **
      /*
        Hash Hierarchy = {
          routeTag: {
            vehicle: {
              stop: [seconds, seconds]
            }
          }
        }
      */

    hashXMLmulti: function(xml, callback) {
      var predictions = {};

      var routeTag, stopTag, vehicle;
      var $stop, $pr;

      $(xml).find('predictions').each(function(indx, prs){
        $stop = $(prs);
        routeTag = $stop.attr('routeTag');
        stopTag = $stop.attr('stopTag');
        if(typeof predictions[routeTag] === 'undefined') { predictions[routeTag] = {}; }

        $stop.find('prediction').each(function(indx, pr){
          $pr = $(pr);
          vehicle = $pr.attr('vehicle');
          if(typeof predictions[routeTag][vehicle] === 'undefined') { predictions[routeTag][vehicle] = {}; }
          if(predictions[routeTag][vehicle][stopTag]) { predictions[routeTag][vehicle][stopTag].push($pr.attr('seconds')); }
          if(typeof predictions[routeTag][vehicle][stopTag] === 'undefined') { predictions[routeTag][vehicle][stopTag] = [$pr.attr('seconds')]; }
        });
      });

      return callback ? callback(predictions) : predictions;
    },

      // combines predictions to estimate the time to a destination by taking the difference
      //  between two stops for a particular vehicle. in conjuction with hashXMLmulti,
      //  will return a result similar to parseXMLmulti, with added 'to destination' times

      //  relies on a predictions hash created by hashXMLmulti. stopQueries and destQueries
      //  are used to determine which stops are stops vs. destinations.

        // there are many loops here; at 4am, they seem necessary..
        //  most loops will be very short: stopQueries is based on the number of routes a user
        //  wants to track (probably a max of 5) and stopTimes and destTimes will most likely
        //  be of length 1. edge cases are the all-nighter routes like the 5-Fulton at 3am,
        //  then the array is of length 2.

    combinePredictions: function(prsHash, stopQueries, destQueries) {
      var predictions = [];
      var query, stopTimes, destTimes;
      var pre;
      var i, j, k, vehicle;

        // sub-routine used to make prediction objects to be pushed into the predictions array
      function mkPrediction(routeTag, vehicle, timeInfo) {
        var prediction = {
          routeTag: routeTag,
          vehicle: vehicle
        };
        _.extend(prediction, timeInfo);
        return prediction;
      }

      for(i=0; i<stopQueries.length; i++) {
        query = stopQueries[i];
        for(vehicle in prsHash[query.r]) {
          if(prsHash[query.r][vehicle][query.s]) {
            stopTimes = prsHash[query.r][vehicle][query.s];
            for(j=0; j<stopTimes.length; j++) {
              pre = mkPrediction(query.r, vehicle, {
                stopTag: query.s,
                seconds: parseInt(stopTimes[j], 10)
              });

              if(destQueries[i] && prsHash[query.r][vehicle][destQueries[i].s]) {
                destTimes = prsHash[query.r][vehicle][destQueries[i].s];

                for(k=j; k<destTimes.length; k++) {
                  if(parseInt(destTimes[k], 10) > parseInt(pre.seconds, 10)) {
                    pre.destTag = destQueries[i].s;
                    pre.secondsTotal = parseInt(destTimes[k], 10);
                    pre.destSeconds = pre.secondsTotal - pre.seconds;
                    break;
                  }
                }
              }
              predictions.push(pre);
            }
          } else if(destQueries[i] && prsHash[query.r][vehicle][destQueries[i].s]) {
              destTimes = prsHash[query.r][vehicle][destQueries[i].s];

              for(k=0; k<destTimes.length; k++) {
                var destInfo = {
                  destTag: destQueries[i].s,
                  destSeconds: parseInt(destTimes[k], 10),
                  seconds: -1
                };
                pre = mkPrediction(destQueries[i].r, vehicle, destInfo);
                predictions.push(pre);
              }
            }
          }
        }
      return predictions;
    },

    init: function(agency, callback) {
      var query = {
        command:'routeList',
        a: agency
      };

      nb.getNextbus(query, function(xml){
        var routes = nb.parseXMLroutes(xml);

        _(routes).each(function(rt){
          nb.routesInfo[rt.routeTag] = {};
          nb.routesInfo[rt.routeTag].title = rt.routeTitle;
        });

        return callback ? callback(routes) : routes;
      });
    }
  };

  if(typeof agency === 'string') {
    nb.init(agency, function(){
      return nb;
    });
  }

  return nb;
};