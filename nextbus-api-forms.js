// var nb = function() {

  var getNextbus = function(query, callback) {
    URLstops = 'http://webservices.nextbus.com/service/publicXMLFeed';

    $.get(URLstops, query, function(xml){
        callback.call(this, xml);
    });
  };

  var parseXMLstops = function(xml, callback) {
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

    return callback ? callback(stopsInfo, routes) : {stopsInfo:stopsInfo, routes:routes};
  };

  var routeOption = Handlebars.compile('<option value="{{key}}">{{title}}{{#if from}} from {{from}}{{/if}}</option>');
  var stopOption = Handlebars.compile('<option value="{{value}}">{{title}}</option>');

  var displayRoutes = function(stopsInfo, routes) {
    var $directionSel = $("#directionSelector");
    $directionSel.empty();
    $("#stopSelector").empty();

    var opt1 = '';

    _(routes).each(function(route, key){

      // if a route has more than two origins add a 'from' to clarify
      if (route.direction === 'Inbound' && Object.keys(routes).length>2) {
        route.from = stopsInfo[route.stops[0]].title;
      }

      route.key = key;
      $directionSel.append(routeOption(route));
    });

    var dirTag = $("#directionSelector").val();
    displayStops(stopsInfo, routes, dirTag);
  };

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

  var parseXMLtimes = function(xml, callback) {
    var times = [];
    var predictions = $(xml).find('prediction').each(function(){
      times.push($(this).attr('seconds'));
    });

    return callback ? callback(times) : times;
  };

// }();

// var displayDests = function(stopsInfo, routes, dirTag, selectedStop) {
//   var $stopSel = $("#stopSelector");
//   $stopSel.empty();

//   selectedStop = selectedStop || routes[dirTag].stops[0];

//   _(routes[dirTag].stops).each(function(stoppy){
//     $stopSel.append('<option value="'+ stoppy +'">'+ stopsInfo[stoppy].title +'</option>');
//   });
// };