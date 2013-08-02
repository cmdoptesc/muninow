var getRoute = function(route) {
  URLstops = 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&r=' + route;

  $.get(URLstops, function(xml){
    stopsInfo = $(xml).find("body route > stop");

    parseXMLstops(xml, displayRoutes);
  });
};

var parseXMLstops = function(xml, cb) {
  // converting raw xml: http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&r=J
  // into two objects, then passing them to a callback

  routes = {};
  var routeTag;
  $(xml).find("direction").each(function(){
    routeTag = $(this).attr("tag");
    routes[routeTag] = {
      'title' : $(this).attr("title"),
      'direction' : $(this).attr("name"),
      'stops' : []
    };
    $(this).find("stop").each(function(){
      routes[routeTag].stops.push($(this).attr("tag"));
    });
  });

  stopsInfo = {};
  $(xml).find("body route > stop").each(function(){
    var $this = $(this);
    var stopTag = $this.attr("tag");
    stopsInfo[stopTag] = {
      'title' : $this.attr("title"),
      'lat' : $this.attr("lat"),
      'lon' : $this.attr("lon"),
      'stopId' : $this.attr("stopId")
    };
  });

  cb(stopsInfo, routes);
};

var routeOption = Handlebars.compile('<option value="{{key}}">{{title}}{{#if from}} from {{from}}{{/if}}</option>');

var displayRoutes = function(stopsInfo, routes) {
  var $directionSel = $("#directionSelector");
  $directionSel.empty();
  $("#stopSelector").empty();

  var opt1 = '';

  _(routes).each(function(route, key){
    var title = route.title;

    //   title += ';
    // $directionSel.append('<option value="'+ key +'">'+ route.title + opt1 +'</option>');

    // Provide data
    route.key = key;
    if (route.direction === 'Inbound' && Object.keys(routes).length>2)
      route.from = stopsInfo[route.stops[0]].title;

    // Let the template handle printing it out
    $directionSel.append(routeOption(route));
  });

  var dirTag = $("#directionSelector").val();

  displayStops(stopsInfo, routes, dirTag);
};

var stopOption = Handlebars.compile('<option value="{{value}}">{{title}}</option>');

var displayStops = function(stopsInfo, routes, dirTag) {
  var $stopSel = $("#stopSelector");
  $stopSel.empty();

  _(routes[dirTag].stops).each(function(stoppy){
    $stopSel.append(stopOption({
      value: stoppy,
      title: stopsInfo[stoppy].title
    }));
  });
};

var getStopTimes = function(stopTag, routeTag, cb, svgElement){
  var routeQuery = '&r=' + routeTag;
  var URLpredictions = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=sf-muni&s=' + stopTag + routeQuery;
  var times = [];

  $.get(URLpredictions, function(xml){
    var pre = $(xml).find('prediction').each(function(){
      times.push($(this).attr('seconds'));
    });

    cb(times, svgElement);
  }, 'xml');
};

// var displayDests = function(stopsInfo, routes, dirTag, selectedStop) {
//   var $stopSel = $("#stopSelector");
//   $stopSel.empty();

//   selectedStop = selectedStop || routes[dirTag].stops[0];

//   _(routes[dirTag].stops).each(function(stoppy){
//     $stopSel.append('<option value="'+ stoppy +'">'+ stopsInfo[stoppy].title +'</option>');
//   });
// };