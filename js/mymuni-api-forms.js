  var getNextbus = function(query, callback) {
    var apiUrl = 'http://webservices.nextbus.com/service/publicXMLFeed';

    $.get(apiUrl, query, function(xml){
        callback.call(this, xml);
    });
  };

    // needed a custom query function since the query URL reuses the "stops" key
    // stopsArray is an array of stop objects in the format: {r: route tag, s: stop tag}
  var getMultiStops = function(stopsArray, callback) {
    var stopsQuery = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni';

    _(stopsArray).each(function(stop) {
      stopsQuery += '&stops='+ stop.r +'|'+ stop.s;
    });

    $.get(stopsQuery, function(xml){
        callback.call(this, xml);
    });
  };

    // converting raw xml: http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&r=J
    // into two objects, then passing them to a callback or as an object
  var parseXMLstops = function(xml, callback) {
    var directions = {};
    $(xml).find("direction").each(function(indx, dir){
      var $this = $(dir);
      var dirTag = $this.attr("tag");
      directions[dirTag] = {
        'title' : $this.attr("title"),
        'name' : $this.attr("name"),
        'dirTag': dirTag,
        'stops' : []
      };
      $this.find("stop").each(function(indx, stop) {
        directions[dirTag].stops.push($(stop).attr("tag"));
      });
    });

    $route = $(xml).find("body > route");

    var stopsInfo = {
      routeTag: $route.attr("tag"),
      title: $route.attr("title"),
      color: $route.attr("color"),
      oppositeColor: $route.attr("oppositeColor")
    };
    $(xml).find("body route > stop").each(function() {
      var $this = $(this);
      var stopTag = $this.attr("tag");
      stopsInfo[stopTag] = {
        'title' : $this.attr("title"),
        'lat' : $this.attr("lat"),
        'lon' : $this.attr("lon"),
        'stopId' : $this.attr("stopId")
      };
    });

    return callback ? callback(stopsInfo, directions) : {stopsInfo:stopsInfo, directions:directions};
  };

    // parses prediction XML for single stops:
    //  http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=sf-muni&r=5&s=5684
  var parseXMLtimes = function(xml, callback) {
    var predictions = [];
    var rT = $(xml).find('predictions').attr('routeTag');
    $(xml).find('prediction').each(function() {
      $pre = $(this);
      var prediction = {
        routeTag: rT,
        seconds: $pre.attr('seconds'),
        vehicle: $pre.attr('vehicle'),
        dirTag: $pre.attr('dirTag')
      };
      predictions.push(prediction);
    });

    return callback ? callback(predictions) : predictions;
  };

    // parses predictionsForMultiStops:
    //  http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni&stops=5|5684&stops=38|5684&stops=38|5689
var parseXMLmulti = function(xml, callback) {
    var predictions = [];
    $(xml).find('predictions').each(function() {
      var $prs = $(this);
      var routeTag = $prs.attr('routeTag');
      var stopTag = $prs.attr('stopTag');

      $prs.find('predictions > direction > prediction').each(function() {
        var $pr = $(this);
        var pre = {
          routeTag: routeTag,
          stopTag: stopTag,
          seconds: $pr.attr('seconds'),
          vehicle: $pr.attr('vehicle')
        };
        predictions.push(pre);
      });
    });

    return callback ? callback(predictions) : predictions;
  };

    // dirTag is optional. if provided, will set drop-down to the specified direction
  var displayDirections = function(stopsInfo, routes, dirTag) {
    var $dirSel = $("#DirectionSelector");
    $dirSel.empty();
    $("#stopSelector").empty();

    var routeOption = Handlebars.compile('<option value="{{value}}">{{title}}{{#if from}} from {{from}}{{/if}}</option>');
    var stopOption = Handlebars.compile('<option value="{{value}}">{{title}}</option>');

    var opt1 = '';

    _(routes).each(function(route, key) {

      // if a route has more than two origins add a 'from' to clarify
      if (route.name === 'Inbound' && Object.keys(routes).length>2) {
        route.from = stopsInfo[route.stops[0]].title;
      }

      route.value = key;
      $dirSel.append(routeOption(route));
    });

    dirTag ? $dirSel.val(dirTag) : dirTag = $dirSel.val();
    displayStops(stopsInfo, routes, dirTag);
  };

  var stopOption = Handlebars.compile('<option value="{{value}}">{{title}}</option>');

    // stopTag is optional. if provided will set drop-down to specified stop
  var displayStops = function(stopsInfo, routes, dirTag, stopTag) {
    var $stopSel = $("#StopSelector");
    $stopSel.empty();

    _(routes[dirTag].stops).each(function(stopNum) {
      $stopSel.append(stopOption({
        value: stopNum,
        title: stopsInfo[stopNum].title
      }));
    });

    stopTag ? $stopSel.val(stopTag) : stopTag = $stopSel.val();
    displayDestinations(stopsInfo, routes, dirTag, stopTag);
  };

  var displayDestinations = function(stopsInfo, routes, dirTag, selectedStop) {
    var $destSel = $("#DestSelector");
    $destSel.empty();

    var stops = routes[dirTag].stops;
    var flag = false;

    _(stops).each(function(stopTag) {
      if(flag) {
        $destSel.append(stopOption({
          value: stopTag,
          title: stopsInfo[stopTag].title
        }));
      }
      if(stopTag === selectedStop) { flag = true; }
    });
  };
