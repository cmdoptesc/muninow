
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